"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useTheme, themeColors } from "@/lib/ThemeContext";
import { getApiUrl } from "@/lib/config";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Task = {
  id: string;
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  assignee: { id: string; name: string } | null;
};

type Column = {
  id: string;
  name: string;
  position: number;
  tasks: Task[];
};

type Board = {
  id: string;
  name: string;
  type: "KANBAN" | "TABLE";
  columns: Column[];
};

type TableBoard = {
  id: string;
  name: string;
  type: "TABLE";
  groups: Array<{ id: string; name: string; position: number }>;
  items: Array<{ id: string; title: string; boardId: string; groupId?: string; position: number }>;
  columns: Array<{ id: string; name: string; type: string; boardId: string; position: number; settings: Record<string, any> }>;
  cells: Record<string, Record<string, any>>;
};

const PRIORITY_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  LOW: { bg: "rgba(66,219,188,0.1)", color: "#42DBBC", border: "rgba(66,219,188,0.25)" },
  MEDIUM: { bg: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "rgba(245,158,11,0.2)" },
  HIGH: { bg: "rgba(239,68,68,0.1)", color: "#f87171", border: "rgba(239,68,68,0.2)" },
};

const GROUP_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#ef4444", "#06b6d4"];

function PersonDropdown({
  members,
  selected,
  groupColor,
  top,
  left,
  onSave,
  onClose,
}: {
  members: Array<{ id: string; name: string; image?: string | null }>;
  selected: string[];
  groupColor: string;
  top: number;
  left: number;
  onSave: (ids: string[]) => void;
  onClose: () => void;
}) {
  const { dark } = useTheme();
  const T = themeColors(dark);
  const [picked, setPicked] = useState<string[]>(selected);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onSave(picked);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [picked, onSave]);

  function toggle(id: string) {
    setPicked((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  return (
    <div ref={ref} style={{
      position: "fixed", top, left, zIndex: 9999,
      background: T.card, border: `1px solid ${T.teal}`,
      borderRadius: "10px", boxShadow: dark ? "0 8px 32px rgba(0,0,0,0.7)" : "0 8px 32px rgba(0,0,0,0.2)",
      minWidth: "220px", maxHeight: "280px", display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ padding: "10px 12px 8px", borderBottom: `1px solid ${T.borderSoft}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: T.t2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Assign people
        </span>
        {picked.length > 0 && (
          <span style={{ fontSize: "11px", fontWeight: 700, color: T.teal, background: "rgba(66,219,188,0.12)", padding: "2px 7px", borderRadius: "10px" }}>
            {picked.length} selected
          </span>
        )}
      </div>
      <div style={{ overflowY: "auto", flex: 1 }}>
        {members.map((m) => {
          const isSelected = picked.includes(m.id);
          return (
            <div
              key={m.id}
              onMouseDown={(e) => { e.preventDefault(); toggle(m.id); }}
              style={{ display: "flex", alignItems: "center", gap: "9px", padding: "8px 12px", cursor: "pointer", background: isSelected ? "rgba(66,219,188,0.08)" : "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = isSelected ? "rgba(66,219,188,0.14)" : T.hover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = isSelected ? "rgba(66,219,188,0.08)" : "transparent")}
            >
              {m.image ? (
                <img src={m.image} alt={m.name} style={{ width: "26px", height: "26px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: groupColor + "33", border: `1.5px solid ${groupColor}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: groupColor, flexShrink: 0 }}>
                  {(m.name[0] ?? "").toUpperCase()}
                </div>
              )}
              <span style={{ fontSize: "13px", color: T.t1, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
              <div style={{ width: "18px", height: "18px", borderRadius: "4px", border: isSelected ? "none" : `1.5px solid ${T.t3}`, background: isSelected ? T.teal : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.1s" }}>
                {isSelected && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke={dark ? "#0d1524" : "#ffffff"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
            </div>
          );
        })}
        {members.length === 0 && (
          <div style={{ padding: "16px 12px", color: T.t3, fontSize: "13px", textAlign: "center" }}>No members in this server</div>
        )}
      </div>
      <div style={{ padding: "8px 12px", borderTop: `1px solid ${T.borderSoft}`, display: "flex", gap: "6px" }}>
        <button
          onMouseDown={(e) => { e.preventDefault(); setPicked([]); }}
          style={{ flex: 1, padding: "6px", fontSize: "12px", color: T.t2, background: "transparent", border: `1px solid ${T.borderSoft}`, borderRadius: "6px", cursor: "pointer" }}
        >Clear</button>
        <button
          onMouseDown={(e) => { e.preventDefault(); onSave(picked); }}
          style={{ flex: 2, padding: "6px", fontSize: "12px", fontWeight: 700, color: dark ? "#0d1524" : "#ffffff", background: T.teal, border: "none", borderRadius: "6px", cursor: "pointer" }}
        >Done</button>
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const { dark } = useTheme();
  const T = themeColors(dark);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });
  const pill = PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.MEDIUM!;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: T.cardAlt,
    border: isDragging ? "1px solid rgba(66,219,188,0.6)" : `1px solid ${T.border}`,
    borderRadius: "10px",
    padding: "12px 14px",
    marginBottom: "8px",
    cursor: isDragging ? "grabbing" : "grab",
    boxShadow: isDragging ? "0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(66,219,188,0.3)" : "none",
    opacity: isDragging ? 0.92 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : 0,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div style={{ fontSize: "14px", color: T.t1, lineHeight: "1.45", marginBottom: task.assignee ? "10px" : "8px" }}>
        {task.title}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <span style={{
          fontSize: "11px", fontWeight: 600, letterSpacing: "0.04em",
          padding: "3px 8px", borderRadius: "20px",
          background: pill.bg, color: pill.color, border: `1px solid ${pill.border}`,
        }}>
          {task.priority}
        </span>
        {task.assignee && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px", color: T.t2, fontSize: "12px" }}>
            <span style={{
              width: "20px", height: "20px", borderRadius: "50%",
              background: T.hover, border: `1px solid ${T.borderSoft}`,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: "10px", fontWeight: 700, color: T.t2, flexShrink: 0,
            }}>
              {(task.assignee.name[0] ?? "").toUpperCase()}
            </span>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "80px" }}>
              {task.assignee.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef} style={{ minHeight: "40px" }}>{children}</div>;
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export default function BoardPage() {
  const { dark } = useTheme();
  const T = themeColors(dark);
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const serverId = params.serverId as string;
  const boardId = params.boardId as string;

  const [board, setBoard] = useState<Board | null>(null);
  const [tableBoard, setTableBoard] = useState<TableBoard>({ id: "", name: "", type: "TABLE", groups: [], items: [], columns: [], cells: {} });
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState<"TEXT" | "STATUS" | "NUMBER" | "DATE" | "PERSON" | "PRIORITY">("TEXT");
  const [editingCell, setEditingCell] = useState<{ itemId: string; columnId: string } | null>(null);
  const [editingCellValue, setEditingCellValue] = useState<any>(null);
  const [serverMembers, setServerMembers] = useState<Array<{ id: string; name: string; image?: string | null }>>([]);
  const [showAiModal, setShowAiModal] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [personPickerPos, setPersonPickerPos] = useState<{ top: number; left: number; groupColor: string } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  async function loadBoard() {
    try {
      const res = await fetch(`${getApiUrl()}/boards/${boardId}`, { credentials: "include" });
      const data: Board = await res.json();
      setBoard(data);
      if (data.type === "TABLE") {
        const tableRes = await fetch(`${getApiUrl()}/boards/${boardId}/table`, { credentials: "include" });
        if (tableRes.ok) {
          const tableData: TableBoard = await tableRes.json();
          setTableBoard(tableData);
          const membersRes = await fetch(`${getApiUrl()}/servers/${serverId}/members`, { credentials: "include" });
          if (membersRes.ok) setServerMembers(await membersRes.json());
        }
      }
    } catch (err) {
      console.error("Failed to load board:", err);
    }
  }

  useEffect(() => { if (boardId) loadBoard(); }, [boardId]);

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || !board) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const sourceColumn = (board?.columns ?? []).find((c) => (c.tasks ?? []).some((t) => t.id === activeId));
    const targetColumn =
      (board?.columns ?? []).find((c) => c.id === overId) ||
      (board?.columns ?? []).find((c) => (c.tasks ?? []).some((t) => t.id === overId));
    if (!sourceColumn || !targetColumn || sourceColumn.id === targetColumn.id) return;
    setBoard((prev) => {
      if (!prev) return prev;
      const task = sourceColumn.tasks.find((t) => t.id === activeId)!;
      return {
        ...prev,
        columns: prev.columns.map((c) => {
          if (c.id === sourceColumn.id) return { ...c, tasks: c.tasks.filter((t) => t.id !== activeId) };
          if (c.id === targetColumn.id) return { ...c, tasks: [...c.tasks, task] };
          return c;
        }),
      };
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !board || !session?.user?.id) return;
    const taskId = active.id as string;
    const targetColumn =
      (board?.columns ?? []).find((c) => c.id === over.id) ||
      (board?.columns ?? []).find((c) => (c.tasks ?? []).some((t) => t.id === over.id));
    if (!targetColumn) return;
    await fetch(`${getApiUrl()}/tasks/${taskId}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.user.id, serverId, columnId: targetColumn.id, position: 0 }),
    });
    loadBoard();
  }

  async function createTask(columnId: string) {
    if (!newTaskTitle.trim() || !session?.user?.id || !board) return;
    await fetch(`${getApiUrl()}/boards/${boardId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.user.id, serverId, title: newTaskTitle, priority: "MEDIUM", columnId }),
    });
    setNewTaskTitle("");
    setActiveColumnId(null);
    loadBoard();
  }

  async function generateWithAi() {
    if (!aiDescription.trim()) { setAiError("Please describe your project"); return; }
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch(`${getApiUrl()}/boards/${boardId}/ai-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ description: aiDescription }),
      });
      const data = await res.json();
      if (!res.ok) { setAiError(data.error || "Failed to generate board"); return; }
      setShowAiModal(false);
      setAiDescription("");
      loadBoard();
    } catch (error) {
      setAiError("Network error. Is the API running?");
    } finally {
      setAiLoading(false);
    }
  }

  if (!session) {
    return (
      <main style={{ minHeight: "100vh", background: T.main, fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ background: T.card, border: `1px solid ${T.borderSoft}`, borderRadius: "16px", padding: "36px 40px", textAlign: "center" }}>
          <p style={{ color: T.t2, fontSize: "15px", margin: 0 }}>
            You must be logged in.{" "}
            <a href="/login" style={{ color: T.teal, textDecoration: "none", fontWeight: 500 }}>Log in</a>
          </p>
        </div>
      </main>
    );
  }

  if (!board) {
    return (
      <main style={{ minHeight: "100vh", background: T.main, fontFamily: FONT, padding: "28px 24px 40px", transition: "background 0.2s ease" }}>
        <div style={{ display: "flex", gap: "16px" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ flexShrink: 0, width: "272px", background: T.card, border: `1px solid ${T.borderSoft}`, borderRadius: "14px", padding: "16px" }}>
              <div style={{ height: "12px", width: "80px", background: T.hover, borderRadius: "6px", marginBottom: "16px", animation: `pulse 1.5s ease-in-out ${i * 0.12}s infinite` }} />
              {[0, 1, 2].map((j) => (
                <div key={j} style={{ height: "68px", background: T.cardAlt, border: `1px solid ${T.borderSoft}`, borderRadius: "10px", marginBottom: "8px", animation: `pulse 1.5s ease-in-out ${(i * 3 + j) * 0.06}s infinite` }} />
              ))}
            </div>
          ))}
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: T.main, fontFamily: FONT, padding: "28px 24px 40px", transition: "background 0.2s ease, color 0.2s ease" }}>
      {/* Board header */}
      <div style={{ marginBottom: "28px" }}>
        <button
          onClick={() => router.push(`/servers/${serverId}/boards`)}
          style={{ background: "none", border: "none", color: T.t3, fontSize: "12px", cursor: "pointer", padding: 0, marginBottom: "10px", display: "flex", alignItems: "center", gap: "4px", fontFamily: FONT, transition: "color 0.15s ease" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = T.teal)}
          onMouseLeave={(e) => (e.currentTarget.style.color = T.t3)}
        >
          ← Boards
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", justifyContent: "space-between" }}>
          <div>
            <p style={{ color: T.teal, fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 4px" }}>Project Board</p>
            <h1 style={{ color: T.t1, fontSize: "24px", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>{board.name}</h1>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {board?.type === "TABLE" && (
              <button
                onClick={() => setShowAiModal(true)}
                style={{ padding: "9px 16px", fontSize: "13px", fontWeight: 600, color: dark ? "#0d1524" : "#ffffff", background: T.teal, border: "none", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                ✨ Generate with AI
              </button>
            )}
            <button
              onClick={async () => {
                if (!session?.user?.id) return;
                const res = await fetch(`${getApiUrl()}/servers/${serverId}/invites`, {
                  method: "POST", credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ createdBy: session.user.id }),
                });
                if (res.ok) {
                  const { code } = await res.json();
                  setInviteLink(`${window.location.origin}/invite/${code}`);
                }
              }}
              style={{ padding: "9px 14px", fontSize: "13px", fontWeight: 600, color: T.teal, background: "rgba(66,219,188,0.1)", border: "1px solid rgba(66,219,188,0.3)", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(66,219,188,0.18)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(66,219,188,0.1)")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
              Invite
            </button>
          </div>
        </div>
      </div>

      {/* ── TABLE VIEW ── */}
      {board?.type === "TABLE" ? (
        <div>
          {/* Toolbar */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "24px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Add Group */}
            {showAddGroup ? (
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input
                  autoFocus
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && newGroupName.trim()) {
                      await fetch(`${getApiUrl()}/boards/${boardId}/groups`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name: newGroupName.trim() }) });
                      setNewGroupName(""); setShowAddGroup(false); loadBoard();
                    }
                    if (e.key === "Escape") { setShowAddGroup(false); setNewGroupName(""); }
                  }}
                  placeholder="Group name…"
                  style={{ padding: "7px 12px", background: T.inputBg, border: `1px solid ${T.teal}`, borderRadius: "7px", color: T.t1, fontSize: "13px", outline: "none", width: "160px" }}
                />
                <button onClick={() => { setShowAddGroup(false); setNewGroupName(""); }} style={{ background: "none", border: "none", color: T.t2, cursor: "pointer", fontSize: "16px" }}>✕</button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddGroup(true)}
                style={{ padding: "7px 14px", fontSize: "13px", fontWeight: 500, color: T.t2, background: T.card, border: `1px dashed ${T.borderSoft}`, borderRadius: "7px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.teal; e.currentTarget.style.color = T.teal; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.borderSoft; e.currentTarget.style.color = T.t2; }}
              >
                + New group
              </button>
            )}

            {/* Add Column */}
            {showAddColumn ? (
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input
                  autoFocus
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder="Column name…"
                  style={{ padding: "7px 12px", background: T.inputBg, border: `1px solid ${T.teal}`, borderRadius: "7px", color: T.t1, fontSize: "13px", outline: "none", width: "140px" }}
                />
                <select
                  value={newColumnType}
                  onChange={(e) => setNewColumnType(e.target.value as any)}
                  style={{ padding: "7px 10px", background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: "7px", color: T.t1, fontSize: "13px", outline: "none" }}
                >
                  <option value="TEXT">Text</option>
                  <option value="NUMBER">Number</option>
                  <option value="DATE">Date</option>
                  <option value="STATUS">Status</option>
                  <option value="PRIORITY">Priority</option>
                  <option value="PERSON">Person</option>
                </select>
                <button
                  onClick={async () => {
                    if (!newColumnName.trim()) return;
                    let settings: any = {};
                    if (newColumnType === "STATUS") settings = { options: [
                      { id: "opt-backlog",     label: "Backlog",      color: "#6b7280" },
                      { id: "opt-todo",        label: "To Do",        color: "#8b5cf6" },
                      { id: "opt-in-progress", label: "In Progress",  color: "#3b82f6" },
                      { id: "opt-review",      label: "In Review",    color: "#f59e0b" },
                      { id: "opt-blocked",     label: "Blocked",      color: "#ef4444" },
                      { id: "opt-done",        label: "Done",         color: "#10b981" },
                    ]};
                    else if (newColumnType === "PRIORITY") settings = { options: [{ id: "prio-low", label: "Low", color: "#10b981" }, { id: "prio-medium", label: "Medium", color: "#f59e0b" }, { id: "prio-high", label: "High", color: "#f97316" }, { id: "prio-urgent", label: "Urgent", color: "#ef4444" }] };
                    await fetch(`${getApiUrl()}/boards/${boardId}/columns`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name: newColumnName.trim(), type: newColumnType, settings }) });
                    setNewColumnName(""); setNewColumnType("TEXT"); setShowAddColumn(false); loadBoard();
                  }}
                  style={{ padding: "7px 12px", background: T.teal, color: dark ? "#0d1524" : "#ffffff", border: "none", borderRadius: "7px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}
                >
                  Add
                </button>
                <button onClick={() => { setShowAddColumn(false); setNewColumnName(""); }} style={{ background: "none", border: "none", color: T.t2, cursor: "pointer", fontSize: "16px" }}>✕</button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddColumn(true)}
                style={{ padding: "7px 14px", fontSize: "13px", fontWeight: 500, color: T.t2, background: T.card, border: `1px dashed ${T.borderSoft}`, borderRadius: "7px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.teal; e.currentTarget.style.color = T.teal; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.borderSoft; e.currentTarget.style.color = T.t2; }}
              >
                + Add column
              </button>
            )}

            {/* Existing columns as pills */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginLeft: "8px" }}>
              {(tableBoard?.columns ?? []).map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", background: "rgba(66,219,188,0.08)", border: "1px solid rgba(66,219,188,0.2)", borderRadius: "20px", fontSize: "12px", color: T.teal }}>
                  <span>{c.name}</span>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Delete column "${c.name}"?`)) return;
                      await fetch(`${getApiUrl()}/columns/${c.id}`, { method: "DELETE", credentials: "include" });
                      loadBoard();
                    }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.teal, opacity: 0.6, padding: "0 2px", fontSize: "11px", lineHeight: 1 }}
                  >✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* Groups */}
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {(tableBoard?.groups ?? []).map((group, groupIdx) => {
              const groupColor = GROUP_COLORS[groupIdx % GROUP_COLORS.length]!;
              const groupItems = (tableBoard?.items ?? []).filter((i) => i.groupId === group.id);
              const cols = tableBoard?.columns ?? [];

              return (
                <div key={group.id}>
                  {/* Group header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                    <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: groupColor, flexShrink: 0 }} />
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: groupColor, letterSpacing: "-0.01em" }}>
                      {group.name}
                    </h3>
                    <span style={{ padding: "2px 8px", background: `${groupColor}22`, border: `1px solid ${groupColor}44`, borderRadius: "20px", fontSize: "11px", fontWeight: 600, color: groupColor }}>
                      {groupItems.length}
                    </span>
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={async () => {
                        const title = prompt("Item title:");
                        if (!title) return;
                        const res = await fetch(`${getApiUrl()}/boards/${boardId}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ title, groupId: group.id }) });
                        if (res.ok) loadBoard();
                      }}
                      style={{ width: "26px", height: "26px", borderRadius: "50%", border: `1.5px solid ${groupColor}66`, background: "transparent", color: groupColor, cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                      title="Add item"
                    >+</button>
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Delete group "${group.name}" and all its items?`)) return;
                        await fetch(`${getApiUrl()}/groups/${group.id}`, { method: "DELETE", credentials: "include" });
                        loadBoard();
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: T.t3, fontSize: "14px", padding: "2px 6px", borderRadius: "4px" }}
                      title="Delete group"
                      onMouseEnter={(e) => (e.currentTarget.style.color = T.red)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = T.t3)}
                    >🗑</button>
                  </div>

                  {/* Table */}
                  <div style={{ background: T.card, borderRadius: "12px", overflow: "hidden", border: `1px solid ${T.borderSoft}` }}>
                    {cols.length > 0 && (
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: `minmax(180px,2fr) repeat(${cols.length}, minmax(120px,1fr)) 40px`,
                        borderBottom: `1px solid ${T.borderSoft}`,
                      }}>
                        <div style={{ padding: "10px 16px 10px 20px", fontSize: "12px", fontWeight: 600, color: T.t2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Task</div>
                        {cols.map((c) => (
                          <div key={c.id} style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: T.t2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{c.name}</div>
                        ))}
                        <div />
                      </div>
                    )}

                    {groupItems.length === 0 ? (
                      <div style={{ padding: "24px 20px", color: T.t3, fontSize: "13px", textAlign: "center" }}>
                        No items yet — click + to add one
                      </div>
                    ) : groupItems.map((item, rowIdx) => (
                      <div
                        key={item.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: cols.length > 0 ? `minmax(180px,2fr) repeat(${cols.length}, minmax(120px,1fr)) 40px` : "1fr 40px",
                          borderBottom: rowIdx < groupItems.length - 1 ? `1px solid ${T.border}` : "none",
                          borderLeft: `3px solid ${groupColor}`,
                          transition: "background 0.12s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = T.rowHover)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {/* Title cell */}
                        <div style={{ padding: "11px 16px 11px 16px", display: "flex", alignItems: "center", fontSize: "14px", color: T.t1, fontWeight: 500 }}>
                          {item.title}
                        </div>

                        {/* Data cells */}
                        {cols.map((col) => {
                          const cellData = tableBoard?.cells[item.id]?.[col.id];
                          const isEditing = editingCell?.itemId === item.id && editingCell?.columnId === col.id;

                          const getDisplayValue = () => {
                            if (!cellData) return null;
                            switch (col.type) {
                              case "TEXT": return cellData.text || null;
                              case "NUMBER": return cellData.number !== undefined ? String(cellData.number) : null;
                              case "DATE": {
                                if (!cellData.date) return null;
                                const d = new Date(cellData.date);
                                const now = new Date();
                                const isOverdue = d < now;
                                const isToday = d.toDateString() === now.toDateString();
                                const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
                                const bg = isToday ? "#f59e0b" : isOverdue ? "#ef4444" : "#06b6d4";
                                return (
                                  <span style={{
                                    display: "inline-block",
                                    padding: "4px 10px",
                                    borderRadius: "5px",
                                    background: bg,
                                    color: "#fff",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    whiteSpace: "nowrap",
                                    letterSpacing: "0.02em",
                                  }}>{label}</span>
                                );
                              }
                              case "STATUS":
                              case "PRIORITY": {
                                const optId = cellData.optionId || cellData.statusId;
                                const options = col.settings?.options || [];
                                const opt = options.find((o: any) => o.id === optId);
                                if (!opt) return null;
                                const labelColorMap: Array<[RegExp, string]> = [
                                  [/done|complete|finish|approv|ship|publish|deploy|launch|success/i, "#10b981"],
                                  [/progress|active|ongoing|develop|build|implement|draft|writ/i,    "#3b82f6"],
                                  [/review|feedback|check|test|qa|verify|audit|inspect/i,            "#f59e0b"],
                                  [/block|stuck|fail|error|cancel|reject|hold/i,                     "#ef4444"],
                                  [/schedul|plan|upcoming|next|queue/i,                              "#06b6d4"],
                                  [/idea|backlog|new|open|todo|to.do|not.start/i,                   "#8b5cf6"],
                                  [/revis|update|rework|fix|patch/i,                                "#f97316"],
                                  [/low|easy|minor/i,                                               "#10b981"],
                                  [/medium|moderate|normal/i,                                        "#f59e0b"],
                                  [/high|hard|major/i,                                              "#f97316"],
                                  [/urgent|critical|blocker|severe/i,                               "#ef4444"],
                                ];
                                const derivedColor = labelColorMap.find(([re]) => re.test(opt.label))?.[1];
                                const c = opt.color || derivedColor || "#8b5cf6";
                                return (
                                  <span style={{
                                    display: "inline-block",
                                    padding: "4px 10px",
                                    borderRadius: "5px",
                                    background: c,
                                    color: "#fff",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    whiteSpace: "nowrap",
                                    letterSpacing: "0.02em",
                                  }}>{opt.label}</span>
                                );
                              }
                              case "PERSON": {
                                const ids: string[] = Array.isArray(cellData.userIds)
                                  ? cellData.userIds
                                  : cellData.userId ? [cellData.userId] : [];
                                const assignees = ids.map((id) => serverMembers.find((m) => m.id === id)).filter(Boolean) as typeof serverMembers;
                                if (assignees.length === 0) return null;
                                const visible = assignees.slice(0, 3);
                                const extra = assignees.length - visible.length;
                                return (
                                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    <div style={{ display: "flex" }}>
                                      {visible.map((member, i) => (
                                        member.image ? (
                                          <img key={member.id} src={member.image} alt={member.name} title={member.name}
                                            style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover", border: `2px solid ${T.card}`, marginLeft: i > 0 ? "-6px" : 0, flexShrink: 0 }} />
                                        ) : (
                                          <div key={member.id} title={member.name} style={{
                                            width: "24px", height: "24px", borderRadius: "50%",
                                            background: `${groupColor}33`, border: `2px solid ${T.card}`,
                                            marginLeft: i > 0 ? "-6px" : 0,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: "10px", fontWeight: 700, color: groupColor, flexShrink: 0,
                                          }}>
                                            {(member.name[0] ?? "").toUpperCase()}
                                          </div>
                                        )
                                      ))}
                                    </div>
                                    {extra > 0 && (
                                      <span style={{ fontSize: "11px", color: T.t2, fontWeight: 600 }}>+{extra}</span>
                                    )}
                                  </div>
                                );
                              }
                              default: return null;
                            }
                          };

                          const saveCell = async (value: any) => {
                            let cellValue: any;
                            if (value === null || value === undefined || value === "") cellValue = null;
                            else switch (col.type) {
                              case "TEXT": cellValue = { text: value }; break;
                              case "NUMBER": cellValue = { number: Number(value) }; break;
                              case "DATE": cellValue = { date: String(value) }; break;
                              case "STATUS":
                              case "PRIORITY": cellValue = { optionId: value }; break;
                              case "PERSON": cellValue = { userId: value }; break;
                              default: cellValue = value;
                            }
                            await fetch(`${getApiUrl()}/cells`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ itemId: item.id, columnId: col.id, value: cellValue }) });
                            setEditingCell(null);
                            loadBoard();
                          };

                          return (
                            <div
                              key={col.id}
                              onClick={(e) => {
                                const initValue = (() => {
                                  if (!cellData) return col.type === "PERSON" ? [] : "";
                                  if (col.type === "STATUS" || col.type === "PRIORITY") return cellData.optionId || cellData.statusId || "";
                                  if (col.type === "PERSON") return Array.isArray(cellData.userIds) ? cellData.userIds : cellData.userId ? [cellData.userId] : [];
                                  if (col.type === "NUMBER") return cellData.number !== undefined ? String(cellData.number) : "";
                                  if (col.type === "DATE") return cellData.date ? String(cellData.date) : "";
                                  return cellData.text || "";
                                })();
                                setEditingCell({ itemId: item.id, columnId: col.id });
                                setEditingCellValue(initValue);
                                if (col.type === "PERSON") {
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  setPersonPickerPos({ top: rect.bottom, left: rect.left, groupColor });
                                } else {
                                  setPersonPickerPos(null);
                                }
                              }}
                              style={{ padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", background: isEditing ? (dark ? "#1a2d42" : "#eef2ff") : "transparent", minWidth: 0 }}
                            >
                              {isEditing ? (
                                col.type === "TEXT" ? (
                                  <input autoFocus type="text" value={editingCellValue || ""} onChange={(e) => setEditingCellValue(e.target.value)}
                                    onBlur={() => saveCell(editingCellValue)}
                                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingCell(null); }}
                                    style={{ width: "100%", padding: "5px 8px", background: T.inputBg, border: `1px solid ${T.teal}`, borderRadius: "6px", color: T.t1, fontSize: "13px", outline: "none" }}
                                  />
                                ) : col.type === "NUMBER" ? (
                                  <input autoFocus type="number" value={editingCellValue} onChange={(e) => setEditingCellValue(e.target.value)}
                                    onBlur={() => saveCell(editingCellValue === "" ? null : editingCellValue)}
                                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingCell(null); }}
                                    style={{ width: "100%", padding: "5px 8px", background: T.inputBg, border: `1px solid ${T.teal}`, borderRadius: "6px", color: T.t1, fontSize: "13px", outline: "none" }}
                                  />
                                ) : col.type === "DATE" ? (
                                  <input autoFocus type="date" value={editingCellValue} onChange={(e) => setEditingCellValue(e.target.value)}
                                    onBlur={() => saveCell(editingCellValue)}
                                    style={{ width: "100%", padding: "5px 8px", background: T.inputBg, border: `1px solid ${T.teal}`, borderRadius: "6px", color: T.t1, fontSize: "13px", outline: "none" }}
                                  />
                                ) : col.type === "STATUS" || col.type === "PRIORITY" ? (
                                  <select autoFocus value={editingCellValue} onChange={(e) => { setEditingCellValue(e.target.value); saveCell(e.target.value); }}
                                    style={{ width: "100%", padding: "5px 8px", background: T.inputBg, border: `1px solid ${T.teal}`, borderRadius: "6px", color: T.t1, fontSize: "13px", outline: "none" }}
                                  >
                                    <option value="">— None —</option>
                                    {(col.settings?.options || []).map((opt: any) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                                  </select>
                                ) : col.type === "PERSON" ? (
                                  <div style={{ minHeight: "22px", display: "flex", alignItems: "center", gap: "6px" }}>
                                    {getDisplayValue() ?? <span style={{ color: T.teal, fontSize: "12px" }}>+ Add people</span>}
                                  </div>
                                ) : (
                                  <input readOnly value={editingCellValue} style={{ width: "100%", padding: "5px 8px", background: T.inputBg, border: `1px solid ${T.teal}`, borderRadius: "6px", color: T.t1, fontSize: "13px", outline: "none" }} />
                                )
                              ) : (
                                <div style={{ minHeight: "22px", display: "flex", alignItems: "center" }}>
                                  {getDisplayValue() ?? <span style={{ color: T.t4, fontSize: "13px" }}>—</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Delete row */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Delete "${item.title}"?`)) return;
                              await fetch(`${getApiUrl()}/items/${item.id}`, { method: "DELETE", credentials: "include" });
                              loadBoard();
                            }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: T.t3, fontSize: "14px", padding: "4px", borderRadius: "4px", transition: "color 0.12s" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = T.red)}
                            onMouseLeave={(e) => (e.currentTarget.style.color = T.t3)}
                            title="Delete item"
                          >🗑</button>
                        </div>
                      </div>
                    ))}

                    {/* Inline add row */}
                    <div
                      style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderTop: groupItems.length > 0 ? `1px solid ${T.border}` : "none", borderLeft: `3px solid ${groupColor}33`, cursor: "pointer", color: T.t3, fontSize: "13px" }}
                      onClick={async () => {
                        const title = prompt("Item title:");
                        if (!title) return;
                        const res = await fetch(`${getApiUrl()}/boards/${boardId}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ title, groupId: group.id }) });
                        if (res.ok) loadBoard();
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = groupColor; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = T.t3; }}
                    >
                      <span style={{ fontSize: "16px" }}>+</span> Add item
                    </div>
                  </div>
                </div>
              );
            })}

            {(tableBoard?.groups ?? []).length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 24px", color: T.t3 }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>📋</div>
                <p style={{ margin: "0 0 16px", fontSize: "15px" }}>No groups yet. Create one to get started.</p>
                <button onClick={() => setShowAddGroup(true)} style={{ padding: "10px 20px", background: T.teal, color: dark ? "#0d1524" : "#ffffff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "14px" }}>
                  + New group
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── KANBAN VIEW ── */
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", overflowX: "auto", paddingBottom: "24px" }}>
            {(board?.columns ?? []).map((column) => (
              <div key={column.id} style={{ flexShrink: 0, width: "272px", background: T.card, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                  <h3 style={{ color: T.t2, fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", margin: 0, flex: 1 }}>{column.name}</h3>
                  <span style={{ background: T.hover, color: T.t2, fontSize: "12px", fontWeight: 500, padding: "2px 8px", borderRadius: "20px", lineHeight: "1.6" }}>
                    {(column.tasks ?? []).length}
                  </span>
                </div>
                <DroppableColumn id={column.id}>
                  <SortableContext items={(column.tasks ?? []).map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    {(column.tasks ?? []).map((task) => <TaskCard key={task.id} task={task} />)}
                  </SortableContext>
                </DroppableColumn>
                {activeColumnId === column.id ? (
                  <div style={{ marginTop: "8px" }}>
                    <input
                      value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && createTask(column.id)}
                      placeholder="Task title..." autoFocus
                      style={{ width: "100%", padding: "10px 12px", fontSize: "14px", color: T.t1, background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: "8px", outline: "none", boxSizing: "border-box", marginBottom: "8px" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = T.teal)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = T.inputBorder)}
                    />
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => createTask(column.id)} style={{ flex: 1, padding: "8px", fontSize: "13px", fontWeight: 600, color: dark ? "#0d1524" : "#ffffff", background: T.teal, border: "none", borderRadius: "8px", cursor: "pointer" }}>Add task</button>
                      <button onClick={() => { setActiveColumnId(null); setNewTaskTitle(""); }} style={{ padding: "8px 12px", fontSize: "13px", color: T.t2, background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", cursor: "pointer" }}>✕</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveColumnId(column.id)}
                    style={{ width: "100%", padding: "8px", marginTop: "8px", fontSize: "13px", fontWeight: 500, color: T.t2, background: "transparent", border: `1px dashed ${T.borderSoft}`, borderRadius: "8px", cursor: "pointer" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.teal; e.currentTarget.style.color = T.teal; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.borderSoft; e.currentTarget.style.color = T.t2; }}
                  >
                    + Add task
                  </button>
                )}
              </div>
            ))}
          </div>
        </DndContext>
      )}

      {/* Invite Modal */}
      {inviteLink && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
          onClick={() => { setInviteLink(null); setInviteCopied(false); }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(460px,100%)", background: T.card, border: `1px solid ${T.borderSoft}`, borderRadius: "16px", padding: "28px", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: T.t1 }}>Invite People</h3>
              <button onClick={() => { setInviteLink(null); setInviteCopied(false); }} style={{ background: "none", border: "none", color: T.t2, cursor: "pointer", fontSize: "18px" }}>✕</button>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: "13px", color: T.t2 }}>Share this link — anyone with it can join the server and then be assigned to tasks.</p>
            <div style={{ display: "flex", gap: "8px" }}>
              <input readOnly value={inviteLink}
                style={{ flex: 1, padding: "10px 12px", background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: "8px", color: T.t2, fontSize: "13px", outline: "none", fontFamily: "monospace" }}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                onClick={() => { navigator.clipboard.writeText(inviteLink); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 2500); }}
                style={{ padding: "10px 16px", borderRadius: "8px", border: "none", background: inviteCopied ? T.green : T.grad, color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", transition: "background 0.2s" }}
              >
                {inviteCopied ? "✓ Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Modal */}
      {showAiModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => !aiLoading && setShowAiModal(false)}>
          <div style={{ background: T.card, border: `1px solid ${T.borderSoft}`, borderRadius: "14px", padding: "28px", maxWidth: "500px", width: "90%" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: T.t1, margin: "0 0 6px", fontSize: "18px", fontWeight: 700 }}>Generate Board with AI</h2>
            <p style={{ color: T.t2, fontSize: "13px", margin: "0 0 18px" }}>Describe your project and AI will create groups, columns, and items.</p>
            <textarea
              value={aiDescription} onChange={(e) => setAiDescription(e.target.value)}
              placeholder="e.g. 'Sprint plan for a mobile app launch with design, development and QA phases'"
              disabled={aiLoading}
              style={{ width: "100%", padding: "12px", fontSize: "13px", color: T.t1, background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: "8px", outline: "none", minHeight: "110px", fontFamily: "inherit", resize: "none", boxSizing: "border-box", marginBottom: "14px" }}
            />
            {aiError && <p style={{ color: T.red, fontSize: "12px", margin: "0 0 12px" }}>⚠️ {aiError}</p>}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button onClick={() => !aiLoading && setShowAiModal(false)} disabled={aiLoading} style={{ padding: "9px 16px", fontSize: "13px", fontWeight: 600, color: T.t2, background: "transparent", border: `1px solid ${T.borderSoft}`, borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
              <button onClick={generateWithAi} disabled={aiLoading} style={{ padding: "9px 16px", fontSize: "13px", fontWeight: 600, color: dark ? "#0d1524" : "#ffffff", background: aiLoading ? "rgba(66,219,188,0.4)" : T.teal, border: "none", borderRadius: "8px", cursor: aiLoading ? "default" : "pointer" }}>
                {aiLoading ? "Generating…" : "Generate ✨"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Person picker portal */}
      {personPickerPos && editingCell && (
        <PersonDropdown
          members={serverMembers}
          selected={Array.isArray(editingCellValue) ? editingCellValue : []}
          groupColor={personPickerPos.groupColor}
          top={personPickerPos.top}
          left={personPickerPos.left}
          onSave={async (ids) => {
            const cellValue = ids.length > 0 ? { userIds: ids } : null;
            await fetch(`${getApiUrl()}/cells`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ itemId: editingCell.itemId, columnId: editingCell.columnId, value: cellValue }),
            });
            setPersonPickerPos(null);
            setEditingCell(null);
            loadBoard();
          }}
          onClose={() => { setPersonPickerPos(null); setEditingCell(null); }}
        />
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </main>
  );
}
