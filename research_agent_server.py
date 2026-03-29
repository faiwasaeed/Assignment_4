"""
Research AI Agent — FastAPI WebSocket Server
============================================
Bridges the Python agent system with the web dashboard.
The dashboard connects via WebSocket and receives real-time
event streams; it sends HITL decisions back through the same socket.

Run with:
    pip install fastapi uvicorn langchain langgraph langchain-community langchain-ollama --break-system-packages
    uvicorn research_agent_server:app --reload --port 8765

Then open the web dashboard and set the server URL to:
    ws://localhost:8765/ws
"""

from __future__ import annotations

import json
import uuid
import time
import asyncio
import functools
from datetime import datetime
from dataclasses import dataclass, asdict, field
from typing import Optional, Literal, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# LangChain
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage, SystemMessage
from langchain_core.tools import tool

# LangChain Community
from langchain_community.tools import (
    DuckDuckGoSearchResults,
    WikipediaQueryRun,
    ArxivQueryRun,
)
from langchain_community.utilities import (
    DuckDuckGoSearchAPIWrapper,
    WikipediaAPIWrapper,
    ArxivAPIWrapper,
)

# LangGraph
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver

# Model
from langchain_ollama import ChatOllama


# ==============================================================================
# EVENT TYPES  (sent over WebSocket to the dashboard)
# ==============================================================================

RouteType = Literal["web", "wikipedia", "arxiv", "general"]

def event(kind: str, **payload) -> str:
    return json.dumps({"type": kind, "ts": datetime.now().isoformat(), **payload})


# ==============================================================================
# TOOL DEFINITIONS
# ==============================================================================

ddgs_wrapper  = DuckDuckGoSearchAPIWrapper(max_results=3)
_ddgs         = DuckDuckGoSearchResults(api_wrapper=ddgs_wrapper)
wiki_wrapper  = WikipediaAPIWrapper(top_k_results=2, doc_content_chars_max=2000)
_wiki         = WikipediaQueryRun(api_wrapper=wiki_wrapper)
arxiv_wrapper = ArxivAPIWrapper(top_k_results=2, doc_content_chars_max=2000)
_arxiv        = ArxivQueryRun(api_wrapper=arxiv_wrapper)


@tool
def web_search(query: str) -> str:
    """Search the web using DuckDuckGo for current news and general information."""
    return _ddgs.run(query)


@tool
def wikipedia_search(query: str) -> str:
    """Search Wikipedia for factual, encyclopedic information."""
    return _wiki.run(query)


@tool
def arxiv_search(query: str) -> str:
    """Search arXiv for academic papers and scientific research."""
    time.sleep(2)
    return _arxiv.run(query)


@tool
def get_current_datetime() -> str:
    """Get the current date and time."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


# ==============================================================================
# LLM + AGENTS
# ==============================================================================

AGENT_PROMPTS = {
    "web": """You are a Web Research Specialist. Search the web for current news and 
general information using the web_search tool. Search once, synthesize clearly.""",
    "wikipedia": """You are a Wikipedia Research Specialist. Look up factual, encyclopedic 
information using the wikipedia_search tool. Give a clear structured answer.""",
    "arxiv": """You are an Academic Research Specialist. Find academic papers using the 
arxiv_search tool. Return paper titles, authors, and key findings.""",
    "general": """You are a General Research Assistant with access to all tools: 
web_search, wikipedia_search, arxiv_search, get_current_datetime. 
Use whichever tools best answer the query. Do not repeat tool calls.
If a tool call was rejected with a reason, adjust your approach.""",
}

SUPERVISOR_PROMPT = """You are a Research Supervisor. Read the user query and decide 
which specialist agent should handle it.

Reply with EXACTLY this format (two lines):
ROUTE: <one of: web, wikipedia, arxiv, general>
CONFIDENCE: <one of: high, medium, low>

Rules:
  web       → current news, prices, live events, recent info
  wikipedia → facts, definitions, history, encyclopedic knowledge
  arxiv     → academic papers, scientific research, technical topics
  general   → needs multiple sources or is ambiguous"""

AGENT_TOOLS = {
    "web":       [web_search, get_current_datetime],
    "wikipedia": [wikipedia_search, get_current_datetime],
    "arxiv":     [arxiv_search, get_current_datetime],
    "general":   [web_search, wikipedia_search, arxiv_search, get_current_datetime],
}


def make_llm():
    return ChatOllama(model="minimax-m2:cloud", base_url="http://localhost:11434", temperature=0)


def build_agents(llm, memory):
    agents = {}
    for name, tools_list in AGENT_TOOLS.items():
        agents[name] = create_react_agent(
            model=llm,
            tools=tools_list,
            prompt=AGENT_PROMPTS[name],
            checkpointer=memory,
            name=f"{name}_agent",
        )
    return agents


def supervisor_route(query: str, llm) -> tuple[str, str]:
    msgs = [SystemMessage(content=SUPERVISOR_PROMPT), HumanMessage(content=query)]
    resp = llm.invoke(msgs)
    text = resp.content.strip().lower()
    route, confidence = "general", "medium"
    for line in text.splitlines():
        if line.startswith("route:"):
            val = line.split(":", 1)[1].strip()
            for v in ("web", "wikipedia", "arxiv", "general"):
                if v in val:
                    route = v
                    break
        elif line.startswith("confidence:"):
            val = line.split(":", 1)[1].strip()
            if val in ("high", "medium", "low"):
                confidence = val
    return route, confidence


# ==============================================================================
# WEBSOCKET SESSION
# ==============================================================================

@dataclass
class HITLConfig:
    enabled: bool = True
    timeout_seconds: int = 0
    batch_mode: bool = False
    auto_approve_datetime: bool = True


@dataclass
class RunRecord:
    id: str
    query: str
    route: str
    confidence: str
    status: str = "running"      # running | completed | error
    answer: str = ""
    tool_calls_made: int = 0
    tool_calls_rejected: int = 0
    revisions: int = 0
    duration: float = 0.0
    decisions: list = field(default_factory=list)
    error: Optional[str] = None


class AgentSession:
    """Manages one WebSocket connection's agent state."""

    def __init__(self, ws: WebSocket):
        self.ws = ws
        self.session_id = str(uuid.uuid4())
        self.llm = make_llm()
        self.memory = MemorySaver()
        self.agents = build_agents(self.llm, self.memory)
        self.hitl_cfg = HITLConfig()
        self.runs: list[RunRecord] = []

        # HITL synchronization: agent waits here for dashboard decision
        self._hitl_event = asyncio.Event()
        self._hitl_decision: Optional[dict] = None

    # ── send helpers ──

    async def send(self, kind: str, **payload):
        await self.ws.send_text(event(kind, **payload))

    async def send_run_state(self, run: RunRecord):
        await self.send("run_state", **asdict(run))

    # ── HITL gate ──

    async def request_hitl(self, checkpoint: str, **payload) -> dict:
        """
        Send a HITL checkpoint to the dashboard and wait for its decision.
        Returns the decision dict sent back by the dashboard.
        """
        self._hitl_event.clear()
        self._hitl_decision = None
        await self.send("hitl_request", checkpoint=checkpoint, **payload)

        timeout = self.hitl_cfg.timeout_seconds or None
        try:
            await asyncio.wait_for(self._hitl_event.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            await self.send("hitl_timeout", checkpoint=checkpoint)
            return {"choice": "approve", "reason": "", "edited_args": payload.get("args", {})}

        return self._hitl_decision or {"choice": "approve"}

    def receive_hitl_decision(self, data: dict):
        self._hitl_decision = data
        self._hitl_event.set()

    # ── Agent runner ──

    async def run_query(self, query: str):
        run_id = str(uuid.uuid4())
        run_start = time.time()

        await self.send("status", message="Routing query…")
        route, confidence = supervisor_route(query, self.llm)
        await self.send("route", route=route, confidence=confidence)

        run = RunRecord(
            id=run_id, query=query,
            route=route, confidence=confidence,
        )
        self.runs.append(run)
        await self.send_run_state(run)

        agent = self.agents[route]
        thread_id = f"{self.session_id}-{route}"
        current_query = query
        final_answer = ""

        while True:
            inputs = {"messages": [HumanMessage(content=current_query)]}
            printed_ids: set = set()
            restart = False

            await self.send("agent_thinking", route=route)

            # Collect tool calls in batch mode
            pending_batch: list[dict] = []

            for chunk in agent.stream(inputs, {"configurable": {"thread_id": thread_id}}, stream_mode="values"):
                msgs = chunk.get("messages", [])
                if not msgs:
                    continue
                msg = msgs[-1]
                mid = getattr(msg, "id", None)
                if mid and mid in printed_ids:
                    continue
                if mid:
                    printed_ids.add(mid)

                if isinstance(msg, AIMessage):
                    if msg.tool_calls:
                        if self.hitl_cfg.batch_mode:
                            pending_batch.extend(msg.tool_calls)
                            for tc in msg.tool_calls:
                                await self.send("tool_queued",
                                                tool_name=tc["name"], args=tc["args"])
                        else:
                            for tc in msg.tool_calls:
                                run.tool_calls_made += 1
                                await self.send_run_state(run)

                                # Auto-approve datetime
                                if self.hitl_cfg.auto_approve_datetime and tc["name"] == "get_current_datetime":
                                    await self.send("tool_auto_approved", tool_name=tc["name"])
                                    continue

                                if self.hitl_cfg.enabled:
                                    decision = await self.request_hitl(
                                        "tool_call",
                                        run_id=run_id,
                                        tool_name=tc["name"],
                                        args=tc["args"],
                                    )
                                    run.decisions.append({
                                        "ts": datetime.now().isoformat(),
                                        "checkpoint": "tool_call",
                                        "tool": tc["name"],
                                        "choice": decision.get("choice", "approve"),
                                        "reason": decision.get("reason", ""),
                                    })
                                    if decision.get("choice") == "reject":
                                        run.tool_calls_rejected += 1
                                        reason = decision.get("reason", "No reason given")
                                        current_query = (
                                            f"Tool call '{tc['name']}' was rejected. "
                                            f"Reason: '{reason}'. "
                                            f"Please try a different approach to: {query}"
                                        )
                                        restart = True
                                        await self.send_run_state(run)
                                        break
                    elif msg.content:
                        final_answer = msg.content
                        await self.send("agent_answer", answer=final_answer, run_id=run_id)

                elif isinstance(msg, ToolMessage):
                    preview = str(msg.content)[:400]
                    await self.send("tool_result",
                                    tool_name=msg.name,
                                    preview=preview,
                                    truncated=len(str(msg.content)) > 400)

            # Handle batch approval
            if pending_batch and not restart:
                await self.send("hitl_batch_request",
                                run_id=run_id,
                                calls=[{"tool_name": tc["name"], "args": tc["args"]}
                                       for tc in pending_batch])
                decision = await self.request_hitl("batch", run_id=run_id,
                                                   call_count=len(pending_batch))
                run.tool_calls_made += len(pending_batch)

                if decision.get("choice") == "reject":
                    run.tool_calls_rejected += len(pending_batch)
                    current_query = (
                        f"All tool calls were rejected. "
                        f"Reason: '{decision.get('reason', '')}'. "
                        f"Try a different approach to: {query}"
                    )
                    restart = True
                await self.send_run_state(run)
                pending_batch.clear()

            if restart:
                final_answer = ""
                continue

            # HITL answer review
            if final_answer:
                if self.hitl_cfg.enabled:
                    decision = await self.request_hitl(
                        "final_answer", run_id=run_id, answer=final_answer
                    )
                    run.decisions.append({
                        "ts": datetime.now().isoformat(),
                        "checkpoint": "final_answer",
                        "choice": decision.get("choice", "approve"),
                        "reason": decision.get("reason", ""),
                    })
                    if decision.get("choice") == "reject":
                        run.revisions += 1
                        feedback = decision.get("reason", "")
                        current_query = (
                            f"User feedback: '{feedback}'. "
                            f"Please revise your answer to: {query}"
                        )
                        final_answer = ""
                        await self.send_run_state(run)
                        continue
                break
            else:
                break

        run.status = "completed"
        run.answer = final_answer
        run.duration = round(time.time() - run_start, 2)
        await self.send_run_state(run)
        await self.send("query_complete", run_id=run_id, duration=run.duration)

        return run


# ==============================================================================
# FASTAPI APP
# ==============================================================================

app = FastAPI(title="Research Agent Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    session = AgentSession(ws)

    await session.send("connected",
                       session_id=session.session_id,
                       hitl_config=asdict(session.hitl_cfg))

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            kind = msg.get("type")

            if kind == "query":
                query = msg.get("query", "").strip()
                if query:
                    asyncio.create_task(session.run_query(query))

            elif kind == "hitl_decision":
                session.receive_hitl_decision(msg)

            elif kind == "config_update":
                cfg = msg.get("config", {})
                if "enabled" in cfg:
                    session.hitl_cfg.enabled = bool(cfg["enabled"])
                if "timeout_seconds" in cfg:
                    session.hitl_cfg.timeout_seconds = int(cfg["timeout_seconds"])
                if "batch_mode" in cfg:
                    session.hitl_cfg.batch_mode = bool(cfg["batch_mode"])
                if "auto_approve_datetime" in cfg:
                    session.hitl_cfg.auto_approve_datetime = bool(cfg["auto_approve_datetime"])
                await session.send("config_ack", config=asdict(session.hitl_cfg))

            elif kind == "get_history":
                await session.send("history",
                                   runs=[asdict(r) for r in session.runs])

            elif kind == "ping":
                await session.send("pong")

    except WebSocketDisconnect:
        print(f"[Session {session.session_id[:8]}] disconnected")
    except Exception as e:
        print(f"[Session error] {e}")
        try:
            await session.send("error", message=str(e))
        except Exception:
            pass


@app.get("/health")
async def health():
    return {"status": "ok", "ts": datetime.now().isoformat()}
