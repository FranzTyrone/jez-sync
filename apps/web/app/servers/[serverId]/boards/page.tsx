"use client";

import { getApiUrl } from '@/lib/config';

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";

type BoardSummary = {
  id: string;
  name: string;
  createdAt: string;
  createdById: string;
  visibility: "PUBLIC" | "PRIVATE";
  _count: { tasks: number };
};

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export default function BoardsPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const serverId = params.serverId as string;

  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [ownerId, setOwnerId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [boardType, setBoardType] = useState<"KANBAN" | "TABLE">("KANBAN");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!serverId) return;
    fetch(`${getApiUrl()}/servers/${serverId}/boards`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data: { boards: BoardSummary[]; ownerId: string }) => {
        setBoards(data.boards ?? []);
        setOwnerId(data.ownerId ?? "");
        setLoading(false);
      });
  }, [serverId]);

  async function createBoard() {
    if (!newName.trim()) return;
    setSubmitting(true);
    const res = await fetch(`${getApiUrl()}/servers/${serverId}/boards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: 'include',
      body: JSON.stringify({ name: newName.trim(), type: boardType }),
    });
    const board = await res.json();
    setSubmitting(false);
    setCreating(false);
    setNewName("");
    setBoardType("KANBAN");
    if (board.id) {
      router.push(`/servers/${serverId}/boards/${board.id}`);
    }
  }

  async function toggleBoardVisibility(boardId: string, currentVisibility: string, e: React.MouseEvent) {
    e.stopPropagation();
    const newVisibility = currentVisibility === "PUBLIC" ? "PRIVATE" : "PUBLIC";
    const res = await fetch(`${getApiUrl()}/boards/${boardId}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: 'include',
      body: JSON.stringify({ visibility: newVisibility }),
    });
    if (res.ok) {
      setBoards((prev) =>
        prev.map((b) =>
          b.id === boardId ? { ...b, visibility: newVisibility as "PUBLIC" | "PRIVATE" } : b
        )
      );
    }
  }

  async function deleteBoard(boardId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this board? This cannot be undone.")) {
      return;
    }
    const res = await fetch(`${getApiUrl()}/boards/${boardId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: 'include',
    });
    if (res.ok) {
      setBoards((prev) => prev.filter((b) => b.id !== boardId));
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (!session) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#0d1117",
          fontFamily: FONT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            background: "#161d2a",
            border: "1px solid #252f42",
            borderRadius: "16px",
            padding: "36px 40px",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#9ca3af", fontSize: "15px", margin: 0 }}>
            You must be logged in.{" "}
            <a href="/login" style={{ color: "#6366f1", textDecoration: "none", fontWeight: 500 }}>
              Log in
            </a>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0d1117",
        fontFamily: FONT,
        padding: "32px 28px 48px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "32px",
        }}
      >
        <div>
          <p
            style={{
              color: "#6366f1",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              margin: "0 0 6px",
            }}
          >
            Project Boards
          </p>
          <h1
            style={{
              color: "#f3f4f6",
              fontSize: "22px",
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Boards
          </h1>
        </div>

        {!creating && (
          <button
            onClick={() => setCreating(true)}
            style={{
              padding: "9px 18px",
              borderRadius: "9px",
              border: "none",
              background: "#6366f1",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#7c7ff2")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#6366f1")}
          >
            + New board
          </button>
        )}
      </div>

      {/* New board form */}
      {creating && (
        <div
          style={{
            background: "#161d2a",
            border: "1px solid #6366f1",
            borderRadius: "14px",
            padding: "20px",
            marginBottom: "24px",
            maxWidth: "400px",
          }}
        >
          <p
            style={{
              color: "#9ca3af",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              margin: "0 0 12px",
            }}
          >
            New board
          </p>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createBoard()}
            placeholder="Board name..."
            autoFocus
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: "14px",
              color: "#f3f4f6",
              background: "#0d1117",
              border: "1px solid #252f42",
              borderRadius: "8px",
              outline: "none",
              boxSizing: "border-box",
              marginBottom: "16px",
              transition: "border-color 0.15s ease",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#252f42")}
          />
          <div style={{ marginBottom: "16px" }}>
            <p style={{ color: "#9ca3af", fontSize: "12px", fontWeight: 600, margin: "0 0 8px" }}>
              Board type:
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              {["KANBAN", "TABLE"].map((type) => (
                <label key={type} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="boardType"
                    value={type}
                    checked={boardType === type}
                    onChange={() => setBoardType(type as "KANBAN" | "TABLE")}
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ color: "#cbd5e1", fontSize: "13px" }}>
                    {type === "KANBAN" ? "Kanban" : "Table"}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={createBoard}
              disabled={submitting || !newName.trim()}
              style={{
                flex: 1,
                padding: "9px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#fff",
                background: submitting ? "#4b4ea8" : "#6366f1",
                border: "none",
                borderRadius: "8px",
                cursor: submitting ? "default" : "pointer",
                transition: "background 0.15s ease",
              }}
            >
              {submitting ? "Creating..." : "Create board"}
            </button>
            <button
              onClick={() => { setCreating(false); setNewName(""); }}
              style={{
                padding: "9px 14px",
                fontSize: "13px",
                color: "#9ca3af",
                background: "transparent",
                border: "1px solid #252f42",
                borderRadius: "8px",
                cursor: "pointer",
                transition: "border-color 0.15s ease, color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#374151";
                e.currentTarget.style.color = "#f3f4f6";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#252f42";
                e.currentTarget.style.color = "#9ca3af";
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Board grid */}
      {loading ? (
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: "240px",
                height: "120px",
                background: "#161d2a",
                border: "1px solid #252f42",
                borderRadius: "14px",
                animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite`,
              }}
            />
          ))}
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        </div>
      ) : !boards || boards.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "64px 0",
            color: "#4b5a72",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "#161d2a",
              border: "1px solid #252f42",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
              marginBottom: "16px",
            }}
          >
            ⊞
          </div>
          <p style={{ fontSize: "15px", fontWeight: 500, color: "#6b7280", margin: "0 0 6px" }}>
            No boards yet
          </p>
          <p style={{ fontSize: "13px", color: "#4b5a72", margin: 0 }}>
            Click "+ New board" to create your first project board.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          {(boards ?? []).map((board) => {
            const canDelete = session?.user?.id === board.createdById || session?.user?.id === ownerId;
            return (
              <div
                key={board.id}
                onClick={() => router.push(`/servers/${serverId}/boards/${board.id}`)}
                style={{
                  width: "240px",
                  background: "#161d2a",
                  border: "1px solid #252f42",
                  borderRadius: "14px",
                  padding: "20px",
                  cursor: "pointer",
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#6366f1";
                  (e.currentTarget as HTMLDivElement).style.boxShadow =
                    "0 0 0 1px rgba(99,102,241,0.2)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#252f42";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    display: "flex",
                    gap: "6px",
                  }}
                >
                  {canDelete && (
                    <>
                      <button
                        onClick={(e) => toggleBoardVisibility(board.id, board.visibility, e)}
                        title={board.visibility === "PUBLIC" ? "Make private" : "Make public"}
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "6px",
                          border: "none",
                          background: "rgba(99,102,241,0.1)",
                          color: "#6366f1",
                          fontSize: "12px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "background 0.15s ease, color 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(99,102,241,0.25)";
                          e.currentTarget.style.color = "#818cf8";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(99,102,241,0.1)";
                          e.currentTarget.style.color = "#6366f1";
                        }}
                      >
                        {board.visibility === "PUBLIC" ? "🌐" : "🔒"}
                      </button>
                      <button
                        onClick={(e) => deleteBoard(board.id, e)}
                        title="Delete board"
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "6px",
                          border: "none",
                          background: "rgba(239,68,68,0.1)",
                          color: "#ef4444",
                          fontSize: "12px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "background 0.15s ease, color 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(239,68,68,0.25)";
                          e.currentTarget.style.color = "#fca5a5";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                          e.currentTarget.style.color = "#ef4444";
                        }}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>

                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(99,102,241,0.12)",
                    border: "1px solid rgba(99,102,241,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    marginBottom: "14px",
                  }}
                >
                  ⊞
                </div>

                <p
                  style={{
                    color: "#f3f4f6",
                    fontSize: "15px",
                    fontWeight: 600,
                    margin: "0 0 10px",
                    letterSpacing: "-0.01em",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {board.name}
                </p>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      background: "#252f42",
                      color: "#6b7280",
                      fontSize: "11px",
                      fontWeight: 500,
                      padding: "2px 8px",
                      borderRadius: "20px",
                    }}
                  >
                    {board._count.tasks} {board._count.tasks === 1 ? "task" : "tasks"}
                  </span>
                  <span style={{ color: "#4b5a72", fontSize: "11px" }}>
                    {formatDate(board.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
