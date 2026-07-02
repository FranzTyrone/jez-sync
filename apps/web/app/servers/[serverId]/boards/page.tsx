"use client";

import { getApiUrl } from '@/lib/config';
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useTheme, themeColors } from "@/lib/ThemeContext";

type BoardSummary = {
  id: string; name: string; createdAt: string; createdById: string;
  visibility: "PUBLIC" | "PRIVATE";
  _count: { tasks: number };
  canAccess: boolean; isLocked: boolean; hasPendingRequest: boolean;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ─── Pending access requests (owner-only panel) ──────────────
function PendingRequestsSection({
  boards, session, ownerId, getPendingRequests, onApprove, onDeny, C,
}: {
  boards: BoardSummary[]; session: any; ownerId: string;
  getPendingRequests: (boardId: string) => Promise<any[]>;
  onApprove: (boardId: string, requestId: string, userName?: string) => Promise<void>;
  onDeny:    (boardId: string, requestId: string, userName?: string) => Promise<void>;
  C: ReturnType<typeof themeColors>;
}) {
  const [requestsByBoard, setRequestsByBoard] = useState<Record<string, any[]>>({});

  const manageableBoards = boards.filter((b) => {
    const canManage = session?.user?.id === b.createdById || session?.user?.id === ownerId;
    return canManage && b.visibility === "PRIVATE";
  });

  useEffect(() => {
    async function load() {
      for (const board of manageableBoards) {
        const reqs = await getPendingRequests(board.id);
        if (reqs.length > 0) setRequestsByBoard((prev) => ({ ...prev, [board.id]: reqs }));
      }
    }
    if (manageableBoards.length > 0) load();
  }, [manageableBoards]);

  const total = Object.values(requestsByBoard).reduce((s, r) => s + r.length, 0);
  if (manageableBoards.length === 0 || total === 0) return null;

  return (
    <div style={{ marginBottom: "36px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: C.t1 }}>
          Pending Access Requests
        </h2>
        <span style={{
          padding: "2px 9px", borderRadius: "100px",
          background: "rgba(239,68,68,0.15)", color: "#fca5a5",
          fontSize: "12px", fontWeight: 700,
        }}>{total}</span>
      </div>
      {manageableBoards.map((board) => {
        const reqs = requestsByBoard[board.id] ?? [];
        if (reqs.length === 0) return null;
        return (
          <div key={board.id} style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: "12px", padding: "16px", marginBottom: "12px",
          }}>
            <p style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 700, color: C.t1 }}>
              {board.name}
              <span style={{ fontSize: "12px", fontWeight: 400, color: C.t3, marginLeft: "8px" }}>
                {reqs.length} {reqs.length === 1 ? "request" : "requests"}
              </span>
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {reqs.map((req: any) => (
                <div key={req.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 12px", background: C.hover,
                  borderRadius: "8px", border: `1px solid ${C.border}`,
                }}>
                  <span style={{ color: C.t2, fontSize: "13px" }}>{req.userName}</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={() => onApprove(board.id, req.id, req.userName)} style={{
                      padding: "5px 12px", fontSize: "12px", fontWeight: 700, color: "#fff",
                      background: C.green, border: "none", borderRadius: "6px", cursor: "pointer",
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    >Approve</button>
                    <button onClick={() => onDeny(board.id, req.id, req.userName)} style={{
                      padding: "5px 12px", fontSize: "12px", fontWeight: 700, color: "#fff",
                      background: C.red, border: "none", borderRadius: "6px", cursor: "pointer",
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    >Deny</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Board card ──────────────────────────────────────────────
const BOARD_COLORS = [
  ["#42DBBC","#21579A"], ["#21579A","#42DBBC"],
  ["#7c3aed","#3b82f6"], ["#10b981","#0ea5e9"],
];

function boardColor(id: string) {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return BOARD_COLORS[hash % BOARD_COLORS.length]!;
}

// ─── Main page ───────────────────────────────────────────────
export default function BoardsPage() {
  const { data: session } = useSession();
  const params   = useParams();
  const router   = useRouter();
  const serverId = params.serverId as string;
  const { dark } = useTheme();
  const C = themeColors(dark);

  const [boards,      setBoards]      = useState<BoardSummary[]>([]);
  const [ownerId,     setOwnerId]     = useState("");
  const [loading,     setLoading]     = useState(true);
  const [creating,    setCreating]    = useState(false);
  const [newName,     setNewName]     = useState("");
  const [boardType,   setBoardType]   = useState<"KANBAN"|"TABLE">("KANBAN");
  const [submitting,  setSubmitting]  = useState(false);
  const [toast,       setToast]       = useState("");
  const [nameFocused, setNameFocused] = useState(false);

  useEffect(() => {
    if (!serverId) return;
    fetch(`${getApiUrl()}/servers/${serverId}/boards`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { boards: BoardSummary[]; ownerId: string }) => {
        setBoards(d.boards ?? []);
        setOwnerId(d.ownerId ?? "");
        setLoading(false);
      });
  }, [serverId]);

  async function createBoard() {
    if (!newName.trim()) return;
    setSubmitting(true);
    const res = await fetch(`${getApiUrl()}/servers/${serverId}/boards`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), type: boardType }),
    });
    const board = await res.json();
    setSubmitting(false); setCreating(false); setNewName(""); setBoardType("KANBAN");
    if (board.id) router.push(`/servers/${serverId}/boards/${board.id}`);
  }

  async function toggleVisibility(boardId: string, current: string, e: React.MouseEvent) {
    e.stopPropagation();
    const next = current === "PUBLIC" ? "PRIVATE" : "PUBLIC";
    const res = await fetch(`${getApiUrl()}/boards/${boardId}/visibility`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: next }),
    });
    if (res.ok) setBoards((prev) => prev.map((b) => b.id === boardId ? { ...b, visibility: next as "PUBLIC"|"PRIVATE" } : b));
  }

  async function deleteBoard(boardId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("Delete this board? This cannot be undone.")) return;
    const res = await fetch(`${getApiUrl()}/boards/${boardId}`, { method: "DELETE", credentials: "include" });
    if (res.ok) setBoards((prev) => prev.filter((b) => b.id !== boardId));
  }

  async function requestAccess(boardId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const res = await fetch(`${getApiUrl()}/boards/${boardId}/access/request`, { method: "POST", credentials: "include" });
    if (res.ok) {
      setBoards((prev) => prev.map((b) => b.id === boardId ? { ...b, hasPendingRequest: true } : b));
      showToast("Access request sent — waiting for approval");
    }
  }

  async function getPendingRequests(boardId: string) {
    const res = await fetch(`${getApiUrl()}/boards/${boardId}/access/requests`, { credentials: "include" });
    if (!res.ok) return [];
    return res.json();
  }

  async function approveRequest(boardId: string, requestId: string, userName?: string) {
    const res = await fetch(`${getApiUrl()}/boards/${boardId}/access/requests/${requestId}/approve`, { method: "POST", credentials: "include" });
    if (res.ok) { showToast(`Access granted to ${userName ?? "user"}`); setTimeout(() => window.location.reload(), 500); }
  }

  async function denyRequest(boardId: string, requestId: string, userName?: string) {
    const res = await fetch(`${getApiUrl()}/boards/${boardId}/access/requests/${requestId}/deny`, { method: "POST", credentials: "include" });
    if (res.ok) { showToast(`Request denied for ${userName ?? "user"}`); setTimeout(() => window.location.reload(), 500); }
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 4000); }

  if (!session) {
    return (
      <main style={{ minHeight: "100vh", background: C.main, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s ease" }}>
        <p style={{ color: C.t3 }}>
          Please <a href="/login" style={{ color: C.teal, fontWeight: 600, textDecoration: "none" }}>log in</a> to continue.
        </p>
      </main>
    );
  }

  return (
    <main style={{
      minHeight: "100vh", background: C.main, padding: "28px 28px 48px",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      transition: "background 0.2s ease, color 0.2s ease",
    }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: "20px", right: "20px", zIndex: 1000,
          background: "rgba(16,185,129,0.9)", backdropFilter: "blur(8px)",
          color: "#fff", padding: "11px 18px", borderRadius: "10px",
          fontSize: "13px", fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          animation: "slideIn 0.25s ease",
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 700, color: C.teal, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Project Boards
          </p>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: C.t1, letterSpacing: "-0.02em" }}>
            Boards
          </h1>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            style={{
              padding: "9px 18px", borderRadius: "9px", border: "none",
              background: C.grad, color: "#fff", fontSize: "13px",
              fontWeight: 700, cursor: "pointer", letterSpacing: "0.02em",
              boxShadow: "0 4px 16px rgba(66,219,188,0.3)",
              transition: "transform 0.12s, box-shadow 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 7px 22px rgba(66,219,188,0.4)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(66,219,188,0.3)";
            }}
          >
            + New board
          </button>
        )}
      </div>

      {/* New board form */}
      {creating && (
        <div style={{
          background: C.card, border: `1px solid rgba(66,219,188,0.25)`,
          borderRadius: "14px", padding: "20px", marginBottom: "28px",
          maxWidth: "400px", boxShadow: dark ? "0 0 0 1px rgba(66,219,188,0.08) inset" : "0 2px 8px rgba(0,0,0,0.06)",
        }}>
          <p style={{ margin: "0 0 14px", fontSize: "11px", fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            New board
          </p>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createBoard()}
            onFocus={() => setNameFocused(true)}
            onBlur={()  => setNameFocused(false)}
            placeholder="Board name…"
            autoFocus
            style={{
              width: "100%", padding: "10px 12px", fontSize: "14px", color: C.t1,
              background: nameFocused ? C.inputBg : C.cardAlt,
              border: nameFocused ? `1px solid rgba(66,219,188,0.6)` : `1px solid ${C.border}`,
              borderRadius: "8px", outline: "none", boxSizing: "border-box", marginBottom: "14px",
              boxShadow: nameFocused ? "0 0 0 3px rgba(66,219,188,0.1)" : "none",
              transition: "all 0.15s",
            }}
          />
          <div style={{ marginBottom: "16px" }}>
            <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Type
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["KANBAN", "TABLE"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setBoardType(type)}
                  style={{
                    padding: "7px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                    border: boardType === type ? "1px solid rgba(66,219,188,0.5)" : `1px solid ${C.border}`,
                    background: boardType === type ? "rgba(66,219,188,0.12)" : C.cardAlt,
                    color: boardType === type ? C.teal : C.t2, cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {type === "KANBAN" ? "⊞ Kanban" : "☰ Table"}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={createBoard}
              disabled={submitting || !newName.trim()}
              style={{
                flex: 1, padding: "9px", fontSize: "13px", fontWeight: 700, color: "#fff",
                background: submitting || !newName.trim() ? "rgba(66,219,188,0.3)" : C.grad,
                border: "none", borderRadius: "8px",
                cursor: submitting || !newName.trim() ? "default" : "pointer",
              }}
            >
              {submitting ? "Creating…" : "Create board"}
            </button>
            <button
              onClick={() => { setCreating(false); setNewName(""); }}
              style={{
                padding: "9px 14px", fontSize: "13px", color: C.t2,
                background: "transparent", border: `1px solid ${C.border}`,
                borderRadius: "8px", cursor: "pointer", transition: "all 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.t1)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.t2)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pending access requests */}
      <PendingRequestsSection
        boards={boards ?? []}
        session={session}
        ownerId={ownerId}
        getPendingRequests={getPendingRequests}
        onApprove={approveRequest}
        onDeny={denyRequest}
        C={C}
      />

      {/* Board grid */}
      {loading ? (
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              width: "240px", height: "156px",
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: "14px", animation: `pulse 1.5s ease-in-out ${i * 0.15}s infinite`,
            }} />
          ))}
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        </div>
      ) : !boards || boards.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "64px 0", gap: "12px" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "16px",
            background: "rgba(66,219,188,0.1)", border: "1px solid rgba(66,219,188,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px",
          }}>⊞</div>
          <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: C.t2 }}>No boards yet</p>
          <p style={{ margin: 0, fontSize: "13px", color: C.t3, textAlign: "center" }}>
            Click "+ New board" to create your first project board.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
          {(boards ?? []).map((board) => {
            const canManage = session?.user?.id === board.createdById || session?.user?.id === ownerId;
            const [c1, c2] = boardColor(board.id);
            return (
              <div
                key={board.id}
                onClick={() => { if (!board.isLocked) router.push(`/servers/${serverId}/boards/${board.id}`); }}
                style={{
                  width: "230px", background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: "14px", overflow: "hidden",
                  cursor: board.isLocked ? "default" : "pointer",
                  transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
                  opacity: board.isLocked ? 0.65 : 1, position: "relative",
                }}
                onMouseEnter={(e) => {
                  if (!board.isLocked) {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.borderColor = "rgba(66,219,188,0.4)";
                    el.style.boxShadow = dark ? "0 8px 24px rgba(0,0,0,0.3)" : "0 8px 24px rgba(0,0,0,0.1)";
                    el.style.transform = "translateY(-2px)";
                  }
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = C.border;
                  el.style.boxShadow = "none";
                  el.style.transform = "translateY(0)";
                }}
              >
                {/* Color header strip */}
                <div style={{
                  height: "5px",
                  background: `linear-gradient(90deg, ${c1} 0%, ${c2} 100%)`,
                }} />

                <div style={{ padding: "14px 16px 14px" }}>
                  {/* Action buttons */}
                  <div style={{ position: "absolute", top: "14px", right: "12px", display: "flex", gap: "5px" }}>
                    {canManage && (
                      <>
                        <button onClick={(e) => toggleVisibility(board.id, board.visibility, e)}
                          title={board.visibility === "PUBLIC" ? "Make private" : "Make public"}
                          style={iconBtnStyle(dark)}
                          onMouseEnter={(e) => (e.currentTarget.style.background = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)")}
                        >
                          {board.visibility === "PUBLIC" ? "🌐" : "🔒"}
                        </button>
                        <button onClick={(e) => deleteBoard(board.id, e)} title="Delete board"
                          style={iconBtnStyle(dark)}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.2)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)")}
                        >✕</button>
                      </>
                    )}
                  </div>

                  {/* Board icon */}
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "10px",
                    background: `linear-gradient(135deg, ${c1}22, ${c2}22)`,
                    border: `1px solid ${c1}33`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "18px", marginBottom: "12px",
                  }}>
                    {board.visibility === "PRIVATE" ? "🔒" : "⊞"}
                  </div>

                  {/* Name */}
                  <p style={{
                    margin: "0 0 10px", fontSize: "14px", fontWeight: 700, color: C.t1,
                    letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    paddingRight: canManage ? "52px" : "0",
                  }}>
                    {board.name}
                  </p>

                  {/* Meta */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{
                      padding: "2px 9px", borderRadius: "100px", fontSize: "10px", fontWeight: 700,
                      background: C.hover, color: C.t3, letterSpacing: "0.04em",
                    }}>
                      {board._count.tasks} task{board._count.tasks !== 1 ? "s" : ""}
                    </span>
                    <span style={{ fontSize: "11px", color: C.t3 }}>{formatDate(board.createdAt)}</span>
                  </div>

                  {/* Request access button for locked boards */}
                  {board.isLocked && !canManage && (
                    <div style={{ marginTop: "12px" }}>
                      {board.hasPendingRequest ? (
                        <div style={{
                          width: "100%", padding: "7px", textAlign: "center",
                          fontSize: "12px", fontWeight: 600, color: C.t3,
                          background: C.hover, borderRadius: "7px",
                          border: `1px solid ${C.border}`,
                        }}>Pending approval…</div>
                      ) : (
                        <button onClick={(e) => requestAccess(board.id, e)} style={{
                          width: "100%", padding: "7px", fontSize: "12px", fontWeight: 700, color: "#fff",
                          background: C.grad, border: "none", borderRadius: "7px", cursor: "pointer",
                        }}>Request Access</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
        input::placeholder { color: ${C.t3}; }
      `}</style>
    </main>
  );
}

function iconBtnStyle(dark: boolean): React.CSSProperties {
  return {
    width: "24px", height: "24px", borderRadius: "6px", border: "none",
    background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
    fontSize: "11px",
    color: dark ? "#94a3b8" : "#64748b", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.12s",
  };
}
