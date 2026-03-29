# 🔬 Research AI Agent — Human-in-the-Loop

A **multi-agent research system** where AI automatically routes your query to the right specialist, executes research using real tools, and **pauses at every critical step for your approval** before proceeding. Monitor everything live from a web dashboard.

---

## 📸 Overview

```
You (Browser Dashboard)
        ↕  WebSocket
   FastAPI Server
        ↕
   Supervisor Agent  →  routes query
        ↓
   ┌──────────────────────────────────────┐
   │  Web Agent │ Wiki Agent │ ArXiv Agent │ General Agent │
   └──────────────────────────────────────┘
        ↓
   Tools (DuckDuckGo · Wikipedia · ArXiv · Datetime)
        ↓
   HITL Checkpoints  ←── YOU approve / reject / edit
        ↓
   Final Answer
```

---

## ✨ Features

### 🤖 Multi-Agent Routing
- **Supervisor Agent** reads your query and routes it to the best specialist
- **Web Agent** — current news, prices, live events (DuckDuckGo)
- **Wikipedia Agent** — facts, history, encyclopedic knowledge
- **ArXiv Agent** — academic papers, scientific research
- **General Agent** — ambiguous queries needing multiple sources
- Confidence scoring on every routing decision (high / medium / low)
- Automatic fallback chain — if specialist fails, escalates to General Agent

### 🛑 Human-in-the-Loop (HITL)
- **Tool call approval** — approve, edit, or reject every tool call before it runs
- **Reject with reason** — your rejection reason is fed back to the agent so it self-corrects
- **Answer review** — accept or request revision with specific feedback
- **Batch mode** — review all tool calls at once instead of one by one
- **Timeout auto-approve** — set a countdown (e.g. 10s); auto-approves if you don't respond
- **Auto-approve datetime** — silently skip trivial time queries
- **Full audit trail** — every decision logged with timestamp and reason

### 📡 Real-Time Dashboard
- Live event feed showing routing, tool calls, results, and answers as they stream
- Run history sidebar with status, route, duration, and decision count per run
- HITL control panel — toggle all settings live without restarting
- Session summary stats — total runs, decisions made, average duration
- Decision log per run showing every approve/reject/edit with reasons

### 🛡️ Resilience
- Automatic retry with exponential backoff on tool failures
- Rate-limit detection (HTTP 429/503) with extended wait
- Structured `RunRecord` capturing full metadata for every query
- Session audit log auto-saved to JSON on exit

---

## 🗂️ Project Structure

```
HIL_Research_Agent/
│
├── research_agent_server.py   # FastAPI WebSocket backend — all AI logic
├── research_dashboard.html    # Standalone web dashboard (no build needed)
├── ResearchDashboard.jsx      # React version of the dashboard
└── README.md
```

---

## ⚙️ Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.11+ | 3.13 confirmed working |
| Ollama | Latest | Local LLM runner |
| LLM Model | Any Ollama model | Default: `minimax-m2:cloud` |
| Browser | Chrome / Firefox | For the dashboard |

---

## 🚀 Installation & Setup

### 1. Install Ollama and pull a model

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh        # Linux/macOS
# Windows: download from https://ollama.com/download

# Pull the default model
ollama pull minimax-m2:cloud

# Or use any model you already have
ollama pull llama3.1
```

> **Swap the model:** Open `research_agent_server.py` and change:
> ```python
> return ChatOllama(model="minimax-m2:cloud", ...)
> # to any model you have, e.g.:
> return ChatOllama(model="llama3.1", ...)
> ```

---

### 2. Set up Python environment

```bash
# Navigate to project folder
cd HIL_Research_Agent

# Create virtual environment
python -m venv .venv

# Activate it
# Windows:
.\.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate
```

---

### 3. Install dependencies

```bash
pip install --upgrade pip

pip install "uvicorn[standard]" fastapi \
  langchain langchain-core langchain-community \
  langgraph langchain-ollama \
  wikipedia arxiv ddgs duckduckgo-search
```

> ⚠️ **Windows note:** If you get execution policy errors on `Activate.ps1`, run:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

---

### 4. Start the backend server

```bash
python -m uvicorn research_agent_server:app --reload --port 8765
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8765
INFO:     Application startup complete.
```

Verify it's healthy at: `http://localhost:8765/health`

---

### 5. Open the dashboard

**Option A — Standalone HTML (recommended, zero setup):**

Double-click `research_dashboard.html` to open it in your browser, or:
```bash
# macOS
open research_dashboard.html

# Linux
xdg-open research_dashboard.html

# Windows — just double-click the file in Explorer
```

**Option B — React (for embedding in a React project):**

```bash
npm create vite@latest ui -- --template react
cd ui
cp ../ResearchDashboard.jsx src/App.jsx
npm install
npm run dev
# Open http://localhost:5173
```

---

### 6. Connect and run

1. In the dashboard topbar, confirm the URL shows `ws://localhost:8765/ws`
2. Click **Connect** — the dot turns 🟢 green
3. Type a query in the bottom input and press **Enter** or **Send →**
4. Watch the live feed and respond to HITL modals as they appear

---

## 🔄 How It Works — Full Workflow

### Step 1 — Query Submitted
You type a question. The dashboard sends it over WebSocket to the server.

### Step 2 — Supervisor Routes
The Supervisor LLM reads your query and picks the best specialist agent plus a confidence level. This appears instantly in the live feed as a colored route badge.

### Step 3 — Specialist Agent Reasons
The chosen agent (Web/Wiki/ArXiv/General) starts a ReAct loop — it reasons about what tool to call and with what arguments.

### Step 4 — HITL Checkpoint: Tool Call
⚠️ **Agent pauses.** A modal appears in the dashboard showing exactly what tool the agent wants to call and with what arguments. You choose:

| Choice | Effect |
|---|---|
| **✓ Approve** | Tool runs as-is |
| **✎ Edit** | You modify the query; agent uses your version |
| **✕ Reject + Reason** | Agent receives your reason and self-corrects |

### Step 5 — Tool Executes
The approved tool fires (DuckDuckGo search, Wikipedia lookup, ArXiv query, or datetime). Results stream to the feed. Middleware auto-retries on failures.

### Step 6 — Agent Answers
The agent synthesizes the tool results into a final answer, displayed in the feed.

### Step 7 — HITL Checkpoint: Answer Review
⚠️ **Agent pauses again.** You review the answer and choose:

| Choice | Effect |
|---|---|
| **✓ Accept** | Run completes, saved to history |
| **↺ Revise + Feedback** | Agent gets your feedback and rewrites |

### Step 8 — Run Saved
The completed run is recorded in the sidebar with full stats: tool calls made, rejections, revisions, duration, and a decision log.

---

## 🎛️ HITL Controls Reference

| Control | Default | Description |
|---|---|---|
| **HITL Approval** | ON | Master toggle for all approval modals |
| **Batch Mode** | OFF | Collect all tool calls, review as a group |
| **Auto-approve Datetime** | ON | Skip `get_current_datetime` silently |
| **Timeout** | Off (0s) | Auto-approve after N seconds if no response |

All controls are live — change them mid-session without restarting anything.

---

## 📡 WebSocket Event Reference

### Server → Dashboard

| Event | Description |
|---|---|
| `connected` | Session started, config sent |
| `route` | Supervisor decision with confidence |
| `agent_thinking` | Agent started reasoning |
| `tool_queued` | Tool call pending (batch mode) |
| `tool_auto_approved` | Datetime call silently approved |
| `hitl_request` | Agent paused — awaiting your decision |
| `tool_result` | Tool ran, result preview |
| `agent_answer` | Final answer ready for review |
| `run_state` | Updated run stats |
| `query_complete` | Run finished |
| `error` | Something went wrong |

### Dashboard → Server

| Event | Description |
|---|---|
| `query` | New research question |
| `hitl_decision` | Your approve / reject / edit response |
| `config_update` | Changed a HITL setting |
| `ping` | Keep-alive |

---

## 🧠 Agent Memory

Each agent type maintains its own memory thread per session:

```
session_id-web        → Web Agent remembers past searches
session_id-wikipedia  → Wiki Agent remembers past lookups
session_id-arxiv      → ArXiv Agent remembers past queries
session_id-general    → General Agent has its own memory
```

Agents do **not** share memory with each other. The dashboard's run history is separate from agent memory — it's a metadata record, not a conversation log.

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---|---|
| `No module named uvicorn` | Run `pip install "uvicorn[standard]"` inside the activated venv |
| `No module named ddgs` | Run `pip install ddgs` |
| Dashboard dot stays red | Make sure uvicorn is running and URL is `ws://localhost:8765/ws` |
| `WebSocket library not detected` | Run `pip install "uvicorn[standard]"` |
| Ollama model not found | Run `ollama pull <modelname>` or change model name in server file |
| DuckDuckGo rate limit errors | Middleware auto-retries; wait a moment and try again |
| ArXiv is slow | Normal — built-in 2s delay to respect rate limits |
| PowerShell execution policy error | Run `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| `pip.exe not found` in venv | Delete `.venv`, recreate with `python -m venv .venv`, reinstall |

---

## 📦 Dependencies

```
fastapi              — Web framework + WebSocket server
uvicorn[standard]    — ASGI server with WebSocket support
langchain            — LLM orchestration framework
langchain-core       — Core LangChain abstractions
langchain-community  — Community tool integrations
langchain-ollama     — Ollama LLM connector
langgraph            — Agent graph execution (ReAct agents)
ddgs                 — DuckDuckGo search backend
duckduckgo-search    — DuckDuckGo wrapper
wikipedia            — Wikipedia API wrapper
arxiv                — ArXiv API wrapper
```

---

## 🗺️ Roadmap / Possible Extensions

- [ ] Add more specialist agents (YouTube, Reddit, PubMed)
- [ ] Persistent audit log viewer in the dashboard
- [ ] Multi-turn conversation mode with full context
- [ ] Export research session as PDF report
- [ ] Voice approval via browser microphone
- [ ] Scheduled research jobs with email delivery
- [ ] Docker container for one-command deployment

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

## 🙏 Built With

- [LangChain](https://langchain.com) — LLM framework
- [LangGraph](https://langchain-ai.github.io/langgraph/) — Agent execution graphs
- [FastAPI](https://fastapi.tiangolo.com) — Backend server
- [Ollama](https://ollama.com) — Local LLM runner
- [DuckDuckGo Search](https://duckduckgo.com) — Web search
- [Wikipedia API](https://www.mediawiki.org/wiki/API) — Encyclopedic knowledge
- [ArXiv API](https://arxiv.org/help/api) — Academic papers
