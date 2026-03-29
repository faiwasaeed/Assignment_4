import { useState, useEffect, useRef, useCallback } from "react";

// ── Design tokens ──────────────────────────────────────────────────────────
const FONT = "'DM Mono', 'Fira Mono', 'Courier New', monospace";
const DISPLAY = "'Syne', 'Space Grotesk', sans-serif";

const ROUTE_META = {
  web:       { color: "#0EA5E9", bg: "#0EA5E920", label: "WEB",  icon: "◎" },
  wikipedia: { color: "#8B5CF6", bg: "#8B5CF620", label: "WIKI", icon: "◈" },
  arxiv:     { color: "#F59E0B", bg: "#F59E0B20", label: "ARXV", icon: "◆" },
  general:   { color: "#10B981", bg: "#10B98120", label: "GEN",  icon: "◉" },
};

const CONF_COLOR = { high: "#10B981", medium: "#F59E0B", low: "#EF4444" };

const STATUS_META = {
  running:   { color: "#F59E0B", dot: "●", label: "Running"   },
  completed: { color: "#10B981", dot: "●", label: "Done"      },
  error:     { color: "#EF4444", dot: "●", label: "Error"     },
  idle:      { color: "#6B7280", dot: "○", label: "Idle"      },
};

// ── Styles ─────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg0: #0A0A0F;
    --bg1: #0F0F18;
    --bg2: #141420;
    --bg3: #1A1A2C;
    --bg4: #20203A;
    --border: #2A2A45;
    --border2: #353560;
    --text0: #F0F0FF;
    --text1: #B8B8D0;
    --text2: #787894;
    --text3: #4A4A66;
    --accent: #6366F1;
    --accent2: #818CF8;
    --green: #10B981;
    --amber: #F59E0B;
    --red: #EF4444;
    --blue: #0EA5E9;
  }

  body {
    font-family: ${FONT};
    background: var(--bg0);
    color: var(--text1);
    height: 100vh;
    overflow: hidden;
  }

  /* ── Layout ── */
  .shell {
    display: grid;
    grid-template-columns: 260px 1fr 320px;
    grid-template-rows: 52px 1fr;
    height: 100vh;
    gap: 0;
  }

  .topbar {
    grid-column: 1 / -1;
    background: var(--bg1);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 20px;
    gap: 16px;
  }

  .sidebar {
    background: var(--bg1);
    border-right: 1px solid var(--border);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .main {
    display: flex;
    flex-direction: column;
    background: var(--bg0);
    overflow: hidden;
  }

  .panel {
    background: var(--bg1);
    border-left: 1px solid var(--border);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  /* ── Typography ── */
  .mono { font-family: ${FONT}; }
  .display { font-family: ${DISPLAY}; }
  .label { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text2); }
  .caption { font-size: 11px; color: var(--text2); }
  .small { font-size: 12px; }
  .body { font-size: 13px; line-height: 1.6; }

  /* ── Connection status ── */
  .conn-dot {
    width: 7px; height: 7px; border-radius: 50%;
    transition: background 0.3s;
  }
  .conn-dot.connected { background: var(--green); box-shadow: 0 0 6px var(--green); }
  .conn-dot.disconnected { background: var(--red); }
  .conn-dot.connecting { background: var(--amber); animation: pulse 1s infinite; }

  @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
  @keyframes spin { to { transform: rotate(360deg) } }
  @keyframes fadeIn { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }
  @keyframes slideIn { from { opacity:0; transform:translateX(8px) } to { opacity:1; transform:translateX(0) } }
  @keyframes glow { 0%,100% { box-shadow: 0 0 8px #6366F130 } 50% { box-shadow: 0 0 20px #6366F160 } }

  /* ── Inputs ── */
  .input-row {
    display: flex;
    gap: 8px;
    padding: 14px 16px;
    border-top: 1px solid var(--border);
    background: var(--bg1);
  }

  .query-input {
    flex: 1;
    background: var(--bg2);
    border: 1px solid var(--border2);
    border-radius: 8px;
    padding: 10px 14px;
    color: var(--text0);
    font-family: ${FONT};
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s;
  }
  .query-input:focus { border-color: var(--accent); }
  .query-input::placeholder { color: var(--text3); }

  .btn {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 10px 18px;
    font-family: ${FONT};
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
    white-space: nowrap;
  }
  .btn:hover { background: var(--accent2); }
  .btn:active { transform: scale(0.97); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

  .btn-ghost {
    background: transparent;
    color: var(--text1);
    border: 1px solid var(--border2);
    border-radius: 6px;
    padding: 6px 12px;
    font-family: ${FONT};
    font-size: 11px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .btn-ghost:hover { background: var(--bg3); border-color: var(--text2); }

  /* ── Toggle ── */
  .toggle-wrap { display: flex; align-items: center; gap: 8px; }
  .toggle { position:relative; width:34px; height:18px; cursor:pointer; }
  .toggle input { opacity:0; width:0; height:0; position:absolute; }
  .toggle-track {
    position: absolute; inset: 0;
    background: var(--bg4);
    border: 1px solid var(--border2);
    border-radius: 9px;
    transition: background 0.2s, border-color 0.2s;
  }
  .toggle input:checked ~ .toggle-track { background: var(--accent); border-color: var(--accent); }
  .toggle-thumb {
    position: absolute;
    top: 2px; left: 2px;
    width: 12px; height: 12px;
    background: var(--text0);
    border-radius: 50%;
    transition: transform 0.2s;
  }
  .toggle input:checked ~ .toggle-thumb { transform: translateX(16px); }

  /* ── Feed ── */
  .feed {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .feed-item {
    animation: fadeIn 0.2s ease;
    padding: 10px 14px;
    border-radius: 8px;
    border-left: 2px solid transparent;
    background: var(--bg2);
    font-size: 12px;
    line-height: 1.5;
  }
  .feed-item.thinking { border-color: var(--accent); }
  .feed-item.tool { border-color: var(--blue); }
  .feed-item.result { border-color: var(--text3); }
  .feed-item.answer { border-color: var(--green); background: #10B98110; }
  .feed-item.hitl { border-color: var(--amber); background: #F59E0B10; }
  .feed-item.route { border-color: var(--accent2); }
  .feed-item.error { border-color: var(--red); background: #EF444410; }

  .feed-tag {
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--bg4);
    color: var(--text2);
    display: inline-block;
    margin-bottom: 4px;
  }

  /* ── HITL Modal ── */
  .hitl-overlay {
    position: fixed; inset: 0;
    background: rgba(10,10,15,0.85);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.15s ease;
  }

  .hitl-card {
    background: var(--bg2);
    border: 1px solid var(--amber);
    border-radius: 16px;
    padding: 28px 32px;
    width: 520px;
    max-width: 95vw;
    box-shadow: 0 0 60px #F59E0B20;
    animation: slideIn 0.2s ease;
  }

  .hitl-title {
    font-family: ${DISPLAY};
    font-size: 16px;
    font-weight: 700;
    color: var(--text0);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .hitl-badge {
    font-size: 10px;
    letter-spacing: 0.1em;
    padding: 3px 8px;
    border-radius: 4px;
    background: #F59E0B20;
    color: var(--amber);
    border: 1px solid #F59E0B40;
  }

  .hitl-meta { font-size: 12px; color: var(--text2); margin-bottom: 16px; }

  .hitl-args {
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 12px;
    color: var(--text0);
    margin-bottom: 16px;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 120px;
    overflow-y: auto;
  }

  .hitl-answer-preview {
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 12px;
    color: var(--text1);
    margin-bottom: 16px;
    max-height: 200px;
    overflow-y: auto;
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .edit-input {
    width: 100%;
    background: var(--bg3);
    border: 1px solid var(--border2);
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--text0);
    font-family: ${FONT};
    font-size: 12px;
    outline: none;
    margin-bottom: 12px;
    transition: border-color 0.2s;
  }
  .edit-input:focus { border-color: var(--accent); }

  .reason-input {
    width: 100%;
    background: var(--bg3);
    border: 1px solid #EF444450;
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--text0);
    font-family: ${FONT};
    font-size: 12px;
    outline: none;
    margin-bottom: 12px;
    transition: border-color 0.2s;
  }
  .reason-input:focus { border-color: var(--red); }

  .hitl-actions { display: flex; gap: 8px; flex-wrap: wrap; }

  .hitl-btn-approve {
    flex: 1;
    padding: 11px;
    background: #10B98120;
    border: 1px solid #10B98160;
    color: var(--green);
    border-radius: 8px;
    font-family: ${FONT};
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s;
    font-weight: 500;
  }
  .hitl-btn-approve:hover { background: #10B98130; }

  .hitl-btn-edit {
    flex: 1;
    padding: 11px;
    background: #6366F120;
    border: 1px solid #6366F160;
    color: var(--accent2);
    border-radius: 8px;
    font-family: ${FONT};
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .hitl-btn-edit:hover { background: #6366F130; }

  .hitl-btn-reject {
    flex: 1;
    padding: 11px;
    background: #EF444420;
    border: 1px solid #EF444460;
    color: var(--red);
    border-radius: 8px;
    font-family: ${FONT};
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .hitl-btn-reject:hover { background: #EF444430; }

  .hitl-btn-revise {
    flex: 1;
    padding: 11px;
    background: #F59E0B20;
    border: 1px solid #F59E0B60;
    color: var(--amber);
    border-radius: 8px;
    font-family: ${FONT};
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .hitl-btn-revise:hover { background: #F59E0B30; }

  /* ── Run cards ── */
  .run-card {
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg2);
    margin: 4px 12px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    animation: fadeIn 0.2s ease;
  }
  .run-card:hover { border-color: var(--border2); background: var(--bg3); }
  .run-card.active { border-color: var(--accent); background: var(--bg3); }

  .run-query {
    font-size: 12px;
    color: var(--text0);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 4px;
  }

  /* ── Stats ── */
  .stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 12px 16px;
  }

  .stat-card {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
  }

  /* ── Timeout ring ── */
  .timeout-ring {
    width: 32px; height: 32px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .timeout-ring svg {
    position: absolute; inset: 0;
    transform: rotate(-90deg);
  }
  .timeout-ring circle {
    fill: none;
    stroke: var(--amber);
    stroke-width: 2.5;
    stroke-dasharray: 88;
    stroke-linecap: round;
    transition: stroke-dashoffset 1s linear;
  }
  .timeout-num {
    font-size: 11px;
    font-weight: 500;
    color: var(--amber);
    z-index: 1;
  }

  /* ── Section headers ── */
  .section-hdr {
    padding: 12px 16px 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
  }

  /* ── Config panel ── */
  .config-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    font-size: 12px;
  }

  .config-row:last-child { border-bottom: none; }

  .slider {
    width: 80px;
    accent-color: var(--accent);
  }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }

  /* ── Spinner ── */
  .spinner {
    width: 14px; height: 14px;
    border: 2px solid var(--border2);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }

  /* ── Route badge ── */
  .route-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    letter-spacing: 0.08em;
    font-weight: 500;
  }
`;

// ── Timeout Ring ───────────────────────────────────────────────────────────
function TimeoutRing({ seconds, total }) {
  const perim = 88;
  const frac = seconds / total;
  const offset = perim * (1 - frac);
  return (
    <div className="timeout-ring">
      <svg viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="14" style={{ strokeDashoffset: offset }} />
      </svg>
      <span className="timeout-num">{seconds}</span>
    </div>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-track" />
      <span className="toggle-thumb" />
    </label>
  );
}

// ── Route Badge ────────────────────────────────────────────────────────────
function RouteBadge({ route }) {
  const m = ROUTE_META[route] || ROUTE_META.general;
  return (
    <span className="route-badge" style={{ background: m.bg, color: m.color }}>
      {m.icon} {m.label}
    </span>
  );
}

// ── HITL Modal ─────────────────────────────────────────────────────────────
function HitlModal({ request, onDecide, timeoutSec }) {
  const [mode, setMode] = useState("idle"); // idle | editing | rejecting | revising
  const [editVal, setEditVal] = useState(
    request?.args ? JSON.stringify(request.args, null, 2) : ""
  );
  const [reason, setReason] = useState("");
  const [countdown, setCountdown] = useState(timeoutSec || 0);
  const timerRef = useRef(null);
  const totalRef = useRef(timeoutSec || 0);

  useEffect(() => {
    if (!timeoutSec) return;
    setCountdown(timeoutSec);
    totalRef.current = timeoutSec;
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          onDecide({ choice: "approve" });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [request?.id]);

  const stopTimer = () => clearInterval(timerRef.current);

  const approve = () => { stopTimer(); onDecide({ choice: "approve" }); };
  const reject  = () => {
    if (mode !== "rejecting") { stopTimer(); setMode("rejecting"); return; }
    onDecide({ choice: "reject", reason });
  };
  const revise  = () => {
    if (mode !== "revising") { stopTimer(); setMode("revising"); return; }
    onDecide({ choice: "reject", reason });
  };
  const edit    = () => {
    if (mode !== "editing") { stopTimer(); setMode("editing"); return; }
    try {
      const parsed = JSON.parse(editVal);
      onDecide({ choice: "approve", edited_args: parsed });
    } catch {
      onDecide({ choice: "approve", edited_args: request.args });
    }
  };

  const isToolCall   = request?.checkpoint === "tool_call";
  const isFinalAnswer = request?.checkpoint === "final_answer";
  const isBatch      = request?.checkpoint === "batch";

  return (
    <div className="hitl-overlay">
      <div className="hitl-card">
        <div className="hitl-title">
          <span style={{ color: "#F59E0B" }}>⚠</span>
          {isToolCall && "Tool Call Approval"}
          {isFinalAnswer && "Review Final Answer"}
          {isBatch && "Batch Tool Approval"}
          <span className="hitl-badge">HITL</span>
          {timeoutSec > 0 && countdown > 0 && (
            <TimeoutRing seconds={countdown} total={totalRef.current} />
          )}
        </div>

        <div className="hitl-meta">
          {isToolCall && `Agent wants to call: `}
          {isToolCall && <strong style={{ color: "#0EA5E9" }}>{request.tool_name}</strong>}
          {isFinalAnswer && "Is this answer satisfactory?"}
          {isBatch && `Agent queued ${request.call_count} tool calls for batch review`}
        </div>

        {isToolCall && request.args && (
          <>
            <div className="label" style={{ marginBottom: 6 }}>Arguments</div>
            <div className="hitl-args">
              {JSON.stringify(request.args, null, 2)}
            </div>
          </>
        )}

        {isFinalAnswer && request.answer && (
          <>
            <div className="label" style={{ marginBottom: 6 }}>Answer</div>
            <div className="hitl-answer-preview">{request.answer}</div>
          </>
        )}

        {mode === "editing" && (
          <>
            <div className="label" style={{ marginBottom: 6 }}>Edit Arguments (JSON)</div>
            <textarea
              className="edit-input"
              rows={4}
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
            />
          </>
        )}

        {(mode === "rejecting" || mode === "revising") && (
          <>
            <div className="label" style={{ marginBottom: 6 }}>
              {mode === "revising" ? "Revision Request" : "Rejection Reason"}
            </div>
            <input
              className="reason-input"
              placeholder={mode === "revising" ? "What should be improved?" : "Why are you rejecting this?"}
              value={reason}
              onChange={e => setReason(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (mode === "revising" ? revise() : reject())}
              autoFocus
            />
          </>
        )}

        <div className="hitl-actions">
          <button className="hitl-btn-approve" onClick={approve}>
            ✓ {mode === "editing" ? "Submit Edit" : "Approve"}
          </button>

          {isToolCall && (
            <button className="hitl-btn-edit" onClick={edit}>
              {mode === "editing" ? "→ Confirm Edit" : "✎ Edit Query"}
            </button>
          )}

          {isFinalAnswer && (
            <button className="hitl-btn-revise" onClick={revise}>
              {mode === "revising" ? "→ Send Feedback" : "↺ Request Revision"}
            </button>
          )}

          <button className="hitl-btn-reject" onClick={reject}>
            {mode === "rejecting" ? "→ Confirm Reject" : "✕ Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Feed Item ──────────────────────────────────────────────────────────────
function FeedItem({ item }) {
  const tags = {
    route:        { tag: "ROUTE",     cls: "route"   },
    agent_thinking:{ tag: "THINKING", cls: "thinking" },
    tool_queued:  { tag: "QUEUED",    cls: "tool"    },
    tool_auto_approved:{ tag: "AUTO", cls: "result"  },
    tool_result:  { tag: "RESULT",    cls: "result"  },
    agent_answer: { tag: "ANSWER",    cls: "answer"  },
    hitl_request: { tag: "HITL",      cls: "hitl"    },
    hitl_timeout: { tag: "TIMEOUT",   cls: "hitl"    },
    hitl_decision:{ tag: "DECISION",  cls: "hitl"    },
    status:       { tag: "STATUS",    cls: "thinking" },
    error:        { tag: "ERROR",     cls: "error"   },
    query_complete:{ tag: "DONE",     cls: "answer"  },
  };

  const meta = tags[item.type] || { tag: item.type.toUpperCase(), cls: "result" };

  const renderContent = () => {
    switch (item.type) {
      case "route":
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RouteBadge route={item.route} />
            <span style={{ color: CONF_COLOR[item.confidence] || "#6B7280", fontSize: 11 }}>
              {item.confidence} confidence
            </span>
          </div>
        );
      case "agent_thinking":
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="spinner" />
            <span style={{ color: "var(--text1)" }}>
              {(ROUTE_META[item.route] || ROUTE_META.general).label} agent thinking…
            </span>
          </div>
        );
      case "tool_queued":
      case "tool_auto_approved":
        return (
          <span>
            <span style={{ color: "#0EA5E9" }}>{item.tool_name}</span>
            {item.args && <span style={{ color: "var(--text2)" }}> {JSON.stringify(item.args)}</span>}
          </span>
        );
      case "tool_result":
        return (
          <span>
            <span style={{ color: "#0EA5E9" }}>{item.tool_name}</span>
            {" → "}
            <span style={{ color: "var(--text1)" }}>{item.preview}</span>
            {item.truncated && <span style={{ color: "var(--text3)" }}> [truncated]</span>}
          </span>
        );
      case "agent_answer":
        return (
          <div style={{ color: "var(--text0)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
            {item.answer}
          </div>
        );
      case "hitl_request":
        return (
          <span style={{ color: "var(--amber)" }}>
            Waiting for approval: <strong>{item.tool_name || item.checkpoint}</strong>
          </span>
        );
      case "hitl_decision":
        return (
          <span>
            Decision: <strong style={{ color: item.choice === "approve" ? "var(--green)" : "var(--red)" }}>
              {item.choice}
            </strong>
            {item.reason && <span style={{ color: "var(--text2)" }}> — {item.reason}</span>}
          </span>
        );
      case "query_complete":
        return (
          <span style={{ color: "var(--green)" }}>
            Completed in {item.duration}s
          </span>
        );
      default:
        return <span style={{ color: "var(--text1)" }}>{item.message || JSON.stringify(item)}</span>;
    }
  };

  return (
    <div className={`feed-item ${meta.cls}`}>
      <div>
        <span className="feed-tag">{meta.tag}</span>
        <span className="caption" style={{ marginLeft: 6, color: "var(--text3)" }}>
          {new Date(item.ts || Date.now()).toLocaleTimeString()}
        </span>
      </div>
      <div style={{ marginTop: 4 }}>{renderContent()}</div>
    </div>
  );
}

// ── Run Card ───────────────────────────────────────────────────────────────
function RunCard({ run, active, onClick }) {
  const sm = STATUS_META[run.status] || STATUS_META.idle;
  return (
    <div className={`run-card ${active ? "active" : ""}`} onClick={onClick}>
      <div className="run-query">{run.query}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <RouteBadge route={run.route} />
        <span style={{ fontSize: 10, color: sm.color }}>{sm.dot} {sm.label}</span>
        {run.duration > 0 && (
          <span className="caption" style={{ marginLeft: "auto" }}>{run.duration}s</span>
        )}
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [wsUrl, setWsUrl] = useState("ws://localhost:8765/ws");
  const [connState, setConnState] = useState("disconnected"); // connecting | connected | disconnected
  const [feed, setFeed] = useState([]);
  const [runs, setRuns] = useState([]);
  const [activeRunId, setActiveRunId] = useState(null);
  const [hitlRequest, setHitlRequest] = useState(null);
  const [query, setQuery] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  // Config
  const [hitlEnabled, setHitlEnabled] = useState(true);
  const [timeoutSec, setTimeoutSec] = useState(0);
  const [batchMode, setBatchMode] = useState(false);
  const [autoDatetime, setAutoDatetime] = useState(true);

  const wsRef = useRef(null);
  const feedEndRef = useRef(null);

  // ── WS helpers ──
  const send = useCallback((obj) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(obj));
    }
  }, []);

  const addFeed = useCallback((item) => {
    setFeed(prev => [...prev.slice(-200), item]);
  }, []);

  // ── Connect ──
  const connect = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    setConnState("connecting");

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnState("connected");
    ws.onclose = () => { setConnState("disconnected"); setIsRunning(false); };
    ws.onerror = () => setConnState("disconnected");

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      addFeed(msg);

      switch (msg.type) {
        case "connected":
          break;

        case "hitl_request":
        case "hitl_batch_request":
          setHitlRequest(msg);
          break;

        case "hitl_timeout":
          setHitlRequest(null);
          break;

        case "run_state":
          setRuns(prev => {
            const idx = prev.findIndex(r => r.id === msg.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = msg;
              return next;
            }
            return [msg, ...prev];
          });
          setActiveRunId(msg.id);
          break;

        case "query_complete":
          setIsRunning(false);
          break;

        case "error":
          setIsRunning(false);
          break;
      }
    };
  }, [wsUrl, addFeed]);

  // ── Send config on change ──
  useEffect(() => {
    send({
      type: "config_update",
      config: {
        enabled: hitlEnabled,
        timeout_seconds: timeoutSec,
        batch_mode: batchMode,
        auto_approve_datetime: autoDatetime,
      }
    });
  }, [hitlEnabled, timeoutSec, batchMode, autoDatetime, send]);

  // ── Auto-scroll feed ──
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [feed]);

  // ── Submit query ──
  const submitQuery = () => {
    if (!query.trim() || isRunning || connState !== "connected") return;
    setIsRunning(true);
    setFeed([]);
    send({ type: "query", query: query.trim() });
    setQuery("");
  };

  // ── HITL decision ──
  const handleHitlDecide = (decision) => {
    addFeed({ type: "hitl_decision", ts: new Date().toISOString(), ...decision });
    send({ type: "hitl_decision", ...decision });
    setHitlRequest(null);
  };

  const activeRun = runs.find(r => r.id === activeRunId);

  return (
    <>
      <style>{css}</style>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap"
      />

      {hitlRequest && (
        <HitlModal
          request={hitlRequest}
          onDecide={handleHitlDecide}
          timeoutSec={timeoutSec}
        />
      )}

      <div className="shell">

        {/* ── Topbar ── */}
        <div className="topbar">
          <span className="display" style={{ fontSize: 15, fontWeight: 700, color: "var(--text0)", letterSpacing: "-0.02em" }}>
            Research<span style={{ color: "var(--accent2)" }}>·AI</span>
          </span>
          <span className="label" style={{ marginLeft: 4 }}>HITL Dashboard</span>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <input
              style={{
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "5px 10px",
                color: "var(--text1)",
                fontFamily: FONT,
                fontSize: 11,
                width: 240,
                outline: "none",
              }}
              value={wsUrl}
              onChange={e => setWsUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && connect()}
            />
            <button className="btn-ghost" onClick={connect}>
              {connState === "connecting" ? "…" : connState === "connected" ? "Reconnect" : "Connect"}
            </button>
            <div className={`conn-dot ${connState}`} />
            <span className="caption">{connState}</span>
          </div>
        </div>

        {/* ── Sidebar — Run History ── */}
        <div className="sidebar">
          <div className="section-hdr">
            <span className="label">Run History</span>
            <span className="caption" style={{ color: "var(--text3)" }}>{runs.length}</span>
          </div>

          {runs.length === 0 && (
            <div style={{ padding: "24px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>◎</div>
              <div className="caption">No runs yet</div>
            </div>
          )}

          {runs.map(run => (
            <RunCard
              key={run.id}
              run={run}
              active={run.id === activeRunId}
              onClick={() => setActiveRunId(run.id)}
            />
          ))}

          {/* Active run stats */}
          {activeRun && (
            <>
              <div className="section-hdr" style={{ marginTop: 8 }}>
                <span className="label">Active Run</span>
              </div>
              <div className="stat-grid">
                {[
                  { label: "Tool Calls", val: activeRun.tool_calls_made },
                  { label: "Rejected",   val: activeRun.tool_calls_rejected, color: activeRun.tool_calls_rejected > 0 ? "var(--red)" : undefined },
                  { label: "Revisions",  val: activeRun.revisions },
                  { label: "Decisions",  val: activeRun.decisions?.length || 0 },
                ].map(s => (
                  <div className="stat-card" key={s.label}>
                    <div className="label">{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 600, marginTop: 2, color: s.color || "var(--text0)", fontFamily: DISPLAY }}>
                      {s.val}
                    </div>
                  </div>
                ))}
              </div>

              {/* Decision log */}
              {activeRun.decisions?.length > 0 && (
                <div style={{ padding: "0 12px 12px" }}>
                  <div className="label" style={{ marginBottom: 8 }}>Decision Log</div>
                  {activeRun.decisions.map((d, i) => (
                    <div key={i} style={{
                      padding: "6px 10px",
                      marginBottom: 4,
                      borderRadius: 6,
                      background: "var(--bg3)",
                      fontSize: 11,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}>
                      <span style={{ color: d.choice === "approve" ? "var(--green)" : "var(--red)" }}>
                        {d.choice === "approve" ? "✓" : "✕"}
                      </span>
                      <span style={{ color: "var(--text1)" }}>
                        {d.checkpoint === "tool_call" ? d.tool : "Final answer"}
                      </span>
                      {d.reason && (
                        <span style={{ color: "var(--text3)", marginLeft: "auto", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.reason}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Main — Event Feed ── */}
        <div className="main">
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
            <span className="label">Live Feed</span>
            {isRunning && <div className="spinner" />}
            {feed.length > 0 && (
              <button className="btn-ghost" onClick={() => setFeed([])} style={{ marginLeft: "auto" }}>
                Clear
              </button>
            )}
          </div>

          <div className="feed">
            {feed.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 32, opacity: 0.15, marginBottom: 8 }}>◉</div>
                <div className="caption">Enter a query to start</div>
              </div>
            )}
            {feed.map((item, i) => (
              <FeedItem key={i} item={item} />
            ))}
            <div ref={feedEndRef} />
          </div>

          <div className="input-row">
            <input
              className="query-input"
              placeholder={connState !== "connected" ? "Connect to server first…" : "Ask anything…"}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitQuery()}
              disabled={connState !== "connected" || isRunning}
            />
            <button
              className="btn"
              onClick={submitQuery}
              disabled={connState !== "connected" || isRunning || !query.trim()}
            >
              {isRunning ? "Running…" : "Send →"}
            </button>
          </div>
        </div>

        {/* ── Right Panel — HITL Config ── */}
        <div className="panel">
          <div className="section-hdr">
            <span className="label">HITL Controls</span>
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 4,
                background: hitlEnabled ? "#10B98120" : "#EF444420",
                color: hitlEnabled ? "var(--green)" : "var(--red)",
                border: `1px solid ${hitlEnabled ? "#10B98140" : "#EF444440"}`,
              }}
            >
              {hitlEnabled ? "ON" : "OFF"}
            </span>
          </div>

          <div className="config-row">
            <div>
              <div style={{ fontSize: 12, color: "var(--text0)", marginBottom: 2 }}>HITL Approval</div>
              <div className="caption">Intercept all tool calls</div>
            </div>
            <Toggle checked={hitlEnabled} onChange={v => {
              setHitlEnabled(v);
              send({ type: "config_update", config: { enabled: v } });
            }} />
          </div>

          <div className="config-row">
            <div>
              <div style={{ fontSize: 12, color: "var(--text0)", marginBottom: 2 }}>Batch Mode</div>
              <div className="caption">Review all calls at once</div>
            </div>
            <Toggle checked={batchMode} onChange={v => {
              setBatchMode(v);
              send({ type: "config_update", config: { batch_mode: v } });
            }} />
          </div>

          <div className="config-row">
            <div>
              <div style={{ fontSize: 12, color: "var(--text0)", marginBottom: 2 }}>Auto-approve Datetime</div>
              <div className="caption">Skip time queries silently</div>
            </div>
            <Toggle checked={autoDatetime} onChange={v => {
              setAutoDatetime(v);
              send({ type: "config_update", config: { auto_approve_datetime: v } });
            }} />
          </div>

          <div className="config-row">
            <div>
              <div style={{ fontSize: 12, color: "var(--text0)", marginBottom: 2 }}>
                Timeout: <span style={{ color: "var(--amber)" }}>{timeoutSec === 0 ? "off" : `${timeoutSec}s`}</span>
              </div>
              <div className="caption">Auto-approve after N seconds</div>
            </div>
            <input
              type="range" min="0" max="60" step="5"
              value={timeoutSec}
              className="slider"
              onChange={e => {
                const v = Number(e.target.value);
                setTimeoutSec(v);
                send({ type: "config_update", config: { timeout_seconds: v } });
              }}
            />
          </div>

          {/* Route legend */}
          <div className="section-hdr" style={{ marginTop: 8 }}>
            <span className="label">Agent Routing</span>
          </div>
          {Object.entries(ROUTE_META).map(([key, m]) => (
            <div key={key} className="config-row" style={{ gap: 10 }}>
              <RouteBadge route={key} />
              <span className="caption" style={{ flex: 1 }}>
                {{ web: "Current news & events", wikipedia: "Facts & encyclopedic", arxiv: "Academic papers", general: "Multi-source & ambiguous" }[key]}
              </span>
            </div>
          ))}

          {/* Session summary */}
          {runs.length > 0 && (
            <>
              <div className="section-hdr" style={{ marginTop: 8 }}>
                <span className="label">Session Summary</span>
              </div>
              <div className="stat-grid">
                {[
                  { label: "Total Runs",      val: runs.length },
                  { label: "Completed",       val: runs.filter(r => r.status === "completed").length },
                  { label: "Decisions Made",  val: runs.reduce((a, r) => a + (r.decisions?.length || 0), 0) },
                  { label: "Avg Duration",    val: runs.filter(r => r.duration > 0).length > 0
                      ? (runs.reduce((a, r) => a + r.duration, 0) / runs.filter(r => r.duration > 0).length).toFixed(1) + "s"
                      : "—"
                  },
                ].map(s => (
                  <div className="stat-card" key={s.label}>
                    <div className="label">{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2, color: "var(--text0)", fontFamily: DISPLAY }}>
                      {s.val}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      </div>
    </>
  );
}
