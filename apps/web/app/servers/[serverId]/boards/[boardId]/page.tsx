"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
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
  LOW: {
    bg: "rgba(99,102,241,0.1)",
    color: "#818cf8",
    border: "rgba(99,102,241,0.2)",
  },
  MEDIUM: {
    bg: "rgba(245,158,11,0.1)",
    color: "#f59e0b",
    border: "rgba(245,158,11,0.2)",
  },
  HIGH: {
    bg: "rgba(239,68,68,0.1)",
    color: "#f87171",
    border: "rgba(239,68,68,0.2)",
  },
};

function TaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const pill = PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.MEDIUM;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: "#0d1117",
    border: isDragging ? "1px solid #6366f1" : "1px solid #252f42",
    borderRadius: "10px",
    padding: "12px 14px",
    marginBottom: "8px",
    cursor: isDragging ? "grabbing" : "grab",
    boxShadow: isDragging
      ? "0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.35)"
      : "none",
    opacity: isDragging ? 0.92 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        style={{
          fontSize: "14px",
          color: "#e2e8f0",
          lineHeight: "1.45",
          marginBottom: task.assignee ? "10px" : "8px",
        }}
      >
        {task.title}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.04em",
            padding: "3px 8px",
            borderRadius: "20px",
            background: pill.bg,
            color: pill.color,
            border: `1px solid ${pill.border}`,
          }}
        >
          {task.priority}
        </span>

        {task.assignee && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              color: "#6b7280",
              fontSize: "12px",
            }}
          >
            <span
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "#252f42",
                border: "1px solid #333d52",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                fontWeight: 700,
                color: "#9ca3af",
                flexShrink: 0,
              }}
            >
              {task.assignee.name[0].toUpperCase()}
            </span>
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "80px",
              }}
            >
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
  return (
    <div ref={setNodeRef} style={{ minHeight: "40px" }}>
      {children}
    </div>
  );
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export default function BoardPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const serverId = params.serverId as string;
  const boardId = params.boardId as string;

  const [board, setBoard] = useState<Board | null>(null);
  const [tableBoard, setTableBoard] = useState<TableBoard | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState<"TEXT" | "STATUS" | "NUMBER" | "DATE" | "PERSON" | "PRIORITY">("TEXT");
  const [editingCell, setEditingCell] = useState<{ itemId: string; columnId: string } | null>(null);
  const [editingCellValue, setEditingCellValue] = useState<any>(null);
  const [serverMembers, setServerMembers] = useState<Array<{ id: string; name: string }>>([]);

  const sensors = useSensors(useSensor(PointerSensor));

  async function loadBoard() {
    try {
      const res = await fetch(`${getApiUrl()}/boards/${boardId}`);
      const data: Board = await res.json();
      setBoard(data);

      if (data.type === "TABLE") {
        const tableRes = await fetch(`${getApiUrl()}/boards/${boardId}/table`);
        const tableData: TableBoard = await tableRes.json();
        setTableBoard(tableData);

        // Fetch server members for PERSON column type
        const membersRes = await fetch(`${getApiUrl()}/servers/${serverId}/members`);
        const members = await membersRes.json();
        setServerMembers(members);
      }
    } catch (err) {
      console.error("Failed to load board:", err);
    }
  }

  useEffect(() => {
    if (!boardId) return;
    loadBoard();
  }, [boardId]);

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || !board) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const sourceColumn = board.columns.find((c) =>
      c.tasks.some((t) => t.id === activeId)
    );
    const targetColumn =
      board.columns.find((c) => c.id === overId) ||
      board.columns.find((c) => c.tasks.some((t) => t.id === overId));

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
      board.columns.find((c) => c.id === over.id) ||
      board.columns.find((c) => c.tasks.some((t) => t.id === over.id));

    if (!targetColumn) return;

    await fetch(`${getApiUrl()}/tasks/${taskId}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: session.user.id,
        serverId,
        columnId: targetColumn.id,
        position: 0,
      }),
    });

    loadBoard();
  }

  async function createTask(columnId: string) {
    if (!newTaskTitle.trim() || !session?.user?.id || !board) return;

    await fetch(`${getApiUrl()}/boards/${boardId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: session.user.id,
        serverId,
        title: newTaskTitle,
        priority: "MEDIUM",
        columnId,
      }),
    });

    setNewTaskTitle("");
    setActiveColumnId(null);
    loadBoard();
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
          padding: "24px",
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

  if (!board) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#0d1117",
          fontFamily: FONT,
          padding: "28px 24px 40px",
        }}
      >
        <div style={{ marginBottom: "28px" }}>
          <div
            style={{
              height: "11px",
              width: "100px",
              background: "#252f42",
              borderRadius: "6px",
              marginBottom: "12px",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          <div
            style={{
              height: "24px",
              width: "180px",
              background: "#252f42",
              borderRadius: "12px",
              animation: "pulse 1.5s ease-in-out 0.1s infinite",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: "16px" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                flexShrink: 0,
                width: "272px",
                background: "#161d2a",
                border: "1px solid #252f42",
                borderRadius: "14px",
                padding: "16px",
              }}
            >
              <div
                style={{
                  height: "12px",
                  width: "80px",
                  background: "#252f42",
                  borderRadius: "6px",
                  marginBottom: "16px",
                  animation: `pulse 1.5s ease-in-out ${i * 0.12}s infinite`,
                }}
              />
              {[0, 1, 2].map((j) => (
                <div
                  key={j}
                  style={{
                    height: "68px",
                    background: "#0d1117",
                    border: "1px solid #252f42",
                    borderRadius: "10px",
                    marginBottom: "8px",
                    animation: `pulse 1.5s ease-in-out ${(i * 3 + j) * 0.06}s infinite`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0d1117",
        fontFamily: FONT,
        padding: "28px 24px 40px",
      }}
    >
      {/* Board header */}
      <div style={{ marginBottom: "28px" }}>
        <button
          onClick={() => router.push(`/servers/${serverId}/boards`)}
          style={{
            background: "none",
            border: "none",
            color: "#4b5a72",
            fontSize: "12px",
            cursor: "pointer",
            padding: 0,
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontFamily: FONT,
            transition: "color 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#6366f1")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5a72")}
        >
          ← Boards
        </button>
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
          Project Board
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
          {board.name}
        </h1>
      </div>

      {/* Table Board View */}
      {board?.type === "TABLE" ? (
        <div style={{ background: "#161d2a", borderRadius: "12px", overflow: "hidden" }}>
          {tableBoard ? (
            <>
              {/* Groups, Items, Columns UI */}
              <div style={{ padding: "16px", borderBottom: "1px solid #252f42" }}>
                <div style={{ marginBottom: "16px" }}>
                  <h3 style={{ color: "#f3f4f6", margin: "0 0 12px", fontSize: "14px", fontWeight: 600 }}>
                    Groups
                  </h3>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    {tableBoard.groups.map((g) => (
                      <div
                        key={g.id}
                        style={{
                          padding: "8px 12px",
                          background: "#0d1117",
                          border: "1px solid #252f42",
                          borderRadius: "6px",
                          color: "#cbd5e1",
                          fontSize: "12px",
                        }}
                      >
                        {g.name}
                      </div>
                    ))}
                    <input
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && newGroupName.trim()) {
                          await fetch(`${getApiUrl()}/boards/${boardId}/groups`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({ name: newGroupName.trim() }),
                          });
                          setNewGroupName("");
                          loadBoard();
                        }
                      }}
                      placeholder="New group... (Enter to add)"
                      style={{
                        padding: "8px 12px",
                        background: "#0d1117",
                        border: "1px solid #252f42",
                        borderRadius: "6px",
                        color: "#cbd5e1",
                        fontSize: "12px",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>
                <div>
                  <h3 style={{ color: "#f3f4f6", margin: "0 0 12px", fontSize: "14px", fontWeight: 600 }}>
                    Columns
                  </h3>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    {tableBoard.columns.map((c) => (
                      <div
                        key={c.id}
                        style={{
                          padding: "8px 12px",
                          background: "#0d1117",
                          border: "1px solid #6366f1",
                          borderRadius: "6px",
                          color: "#cbd5e1",
                          fontSize: "12px",
                          display: "flex",
                          gap: "6px",
                          alignItems: "center",
                        }}
                      >
                        <span>{c.name} ({c.type})</span>
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Delete column "${c.name}"?`)) return;
                            await fetch(`${getApiUrl()}/columns/${c.id}`, {
                              method: "DELETE",
                              credentials: "include",
                            });
                            loadBoard();
                          }}
                          style={{
                            fontSize: "11px",
                            padding: "2px 4px",
                            background: "#7f1d1d",
                            color: "#fff",
                            border: "none",
                            borderRadius: "3px",
                            cursor: "pointer",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: "4px" }}>
                      <input
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        placeholder="Column name..."
                        style={{
                          padding: "8px 12px",
                          background: "#0d1117",
                          border: "1px solid #252f42",
                          borderRadius: "6px",
                          color: "#cbd5e1",
                          fontSize: "12px",
                          outline: "none",
                        }}
                      />
                      <select
                        value={newColumnType}
                        onChange={(e) => setNewColumnType(e.target.value as any)}
                        style={{
                          padding: "8px 12px",
                          background: "#0d1117",
                          border: "1px solid #252f42",
                          borderRadius: "6px",
                          color: "#cbd5e1",
                          fontSize: "12px",
                          outline: "none",
                        }}
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
                          if (newColumnType === "STATUS") {
                            // User-defined status options
                            settings = {
                              options: [
                                { id: "opt-todo", label: "To Do", color: "#8b5cf6" },
                                { id: "opt-in-progress", label: "In Progress", color: "#3b82f6" },
                                { id: "opt-done", label: "Done", color: "#10b981" },
                              ],
                            };
                          } else if (newColumnType === "PRIORITY") {
                            // Fixed priority options
                            settings = {
                              options: [
                                { id: "prio-low", label: "Low", color: "#8b5cf6" },
                                { id: "prio-medium", label: "Medium", color: "#f59e0b" },
                                { id: "prio-high", label: "High", color: "#ef4444" },
                                { id: "prio-urgent", label: "Urgent", color: "#dc2626" },
                              ],
                            };
                          }
                          await fetch(`${getApiUrl()}/boards/${boardId}/columns`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({
                              name: newColumnName.trim(),
                              type: newColumnType,
                              settings,
                            }),
                          });
                          setNewColumnName("");
                          setNewColumnType("TEXT");
                          loadBoard();
                        }}
                        style={{
                          padding: "8px 12px",
                          background: "#6366f1",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: 500,
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div style={{ padding: "16px", overflowX: "auto" }}>
                {/* Groups as table sections */}
                {tableBoard.groups.map((group) => (
                  <div key={group.id} style={{ marginBottom: "24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <h4 style={{ color: "#cbd5e1", margin: 0, fontSize: "13px", fontWeight: 600 }}>
                        {group.name}
                      </h4>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={async () => {
                            const title = prompt("Item title:");
                            if (!title) return;
                            const res = await fetch(`${getApiUrl()}/boards/${boardId}/items`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              credentials: "include",
                              body: JSON.stringify({ title, groupId: group.id }),
                            });
                            if (res.ok) loadBoard();
                          }}
                          style={{
                            fontSize: "12px",
                            padding: "4px 8px",
                            background: "#6366f1",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          + Add item
                        </button>
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Delete group "${group.name}" and all its items?`)) return;
                            await fetch(`${getApiUrl()}/groups/${group.id}`, {
                              method: "DELETE",
                              credentials: "include",
                            });
                            loadBoard();
                          }}
                          style={{
                            fontSize: "12px",
                            padding: "4px 8px",
                            background: "#7f1d1d",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", color: "#cbd5e1", fontSize: "13px", marginBottom: "16px" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #252f42" }}>
                          <th style={{ textAlign: "left", padding: "8px", color: "#9ca3af", fontWeight: 500 }}>Title</th>
                          {tableBoard.columns.map((c) => (
                            <th key={c.id} style={{ textAlign: "left", padding: "8px", color: "#9ca3af", fontWeight: 500 }}>
                              {c.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableBoard.items.filter((i) => i.groupId === group.id).map((item) => (
                          <tr key={item.id} style={{ borderBottom: "1px solid #252f42" }}>
                            <td style={{ padding: "8px", minWidth: "150px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                              <span>{item.title}</span>
                              <button
                                onClick={async () => {
                                  if (!window.confirm(`Delete "${item.title}"?`)) return;
                                  await fetch(`${getApiUrl()}/items/${item.id}`, {
                                    method: "DELETE",
                                    credentials: "include",
                                  });
                                  loadBoard();
                                }}
                                style={{
                                  fontSize: "11px",
                                  padding: "2px 6px",
                                  background: "#7f1d1d",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: "3px",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                🗑
                              </button>
                            </td>
                            {tableBoard.columns.map((col) => {
                              const cellData = tableBoard.cells[item.id]?.[col.id];
                              const isEditing = editingCell?.itemId === item.id && editingCell?.columnId === col.id;

                              // Helper to get display value based on type
                              const getDisplayValue = () => {
                                if (!cellData) return "-";
                                switch (col.type) {
                                  case "TEXT": return cellData.text || "-";
                                  case "NUMBER": return cellData.number !== undefined ? String(cellData.number) : "-";
                                  case "DATE": return cellData.date ? String(cellData.date) : "-";
                                  case "STATUS":
                                  case "PRIORITY": {
                                    const optId = cellData.optionId || cellData.statusId; // Backward compat
                                    const options = col.settings?.options || [];
                                    return options.find((o: any) => o.id === optId)?.label || "-";
                                  }
                                  case "PERSON": {
                                    const member = serverMembers.find((m) => m.id === cellData.userId);
                                    return member?.name || "Unknown";
                                  }
                                  default: return "-";
                                }
                              };

                              // Helper to save cell
                              const saveCell = async (value: any) => {
                                if (value === null || value === undefined || value === "") {
                                  // Clear the cell
                                  await fetch("${getApiUrl()}/cells", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    credentials: "include",
                                    body: JSON.stringify({ itemId: item.id, columnId: col.id, value: null }),
                                  });
                                } else {
                                  let cellValue: any;
                                  switch (col.type) {
                                    case "TEXT": cellValue = { text: value }; break;
                                    case "NUMBER": cellValue = { number: Number(value) }; break;
                                    case "DATE": cellValue = { date: String(value) }; break;
                                    case "STATUS":
                                    case "PRIORITY": cellValue = { optionId: value }; break;
                                    case "PERSON": cellValue = { userId: value }; break;
                                    default: cellValue = value;
                                  }
                                  await fetch("${getApiUrl()}/cells", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    credentials: "include",
                                    body: JSON.stringify({ itemId: item.id, columnId: col.id, value: cellValue }),
                                  });
                                }
                                setEditingCell(null);
                                loadBoard();
                              };

                              return (
                                <td
                                  key={col.id}
                                  onClick={() => {
                                    setEditingCell({ itemId: item.id, columnId: col.id });
                                    let initValue = "";
                                    if (cellData) {
                                      if (col.type === "STATUS" || col.type === "PRIORITY") initValue = cellData.optionId || cellData.statusId || "";
                                      else if (col.type === "PERSON") initValue = cellData.userId || "";
                                      else if (col.type === "NUMBER") initValue = cellData.number !== undefined ? String(cellData.number) : "";
                                      else if (col.type === "DATE") initValue = cellData.date ? String(cellData.date) : "";
                                      else initValue = cellData.text || "";
                                    }
                                    setEditingCellValue(initValue);
                                  }}
                                  style={{
                                    padding: "8px",
                                    background: isEditing ? "#1e293b" : "#0d1117",
                                    cursor: "pointer",
                                    minWidth: "120px",
                                  }}
                                >
                                  {isEditing ? (
                                    col.type === "TEXT" ? (
                                      <input
                                        autoFocus
                                        type="text"
                                        value={editingCellValue || ""}
                                        onChange={(e) => setEditingCellValue(e.target.value)}
                                        onBlur={() => saveCell(editingCellValue)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                          if (e.key === "Escape") setEditingCell(null);
                                        }}
                                        style={{
                                          width: "100%",
                                          padding: "4px",
                                          background: "#0d1117",
                                          border: "1px solid #6366f1",
                                          borderRadius: "4px",
                                          color: "#cbd5e1",
                                          fontSize: "12px",
                                          outline: "none",
                                        }}
                                      />
                                    ) : col.type === "NUMBER" ? (
                                      <input
                                        autoFocus
                                        type="number"
                                        value={editingCellValue}
                                        onChange={(e) => setEditingCellValue(e.target.value)}
                                        onBlur={() => saveCell(editingCellValue === "" ? null : editingCellValue)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                          if (e.key === "Escape") setEditingCell(null);
                                        }}
                                        style={{
                                          width: "100%",
                                          padding: "4px",
                                          background: "#0d1117",
                                          border: "1px solid #6366f1",
                                          borderRadius: "4px",
                                          color: "#cbd5e1",
                                          fontSize: "12px",
                                          outline: "none",
                                        }}
                                      />
                                    ) : col.type === "DATE" ? (
                                      <input
                                        autoFocus
                                        type="date"
                                        value={editingCellValue}
                                        onChange={(e) => setEditingCellValue(e.target.value)}
                                        onBlur={() => saveCell(editingCellValue)}
                                        style={{
                                          width: "100%",
                                          padding: "4px",
                                          background: "#0d1117",
                                          border: "1px solid #6366f1",
                                          borderRadius: "4px",
                                          color: "#cbd5e1",
                                          fontSize: "12px",
                                          outline: "none",
                                        }}
                                      />
                                    ) : col.type === "STATUS" || col.type === "PRIORITY" ? (
                                      <select
                                        autoFocus
                                        value={editingCellValue}
                                        onChange={(e) => {
                                          setEditingCellValue(e.target.value);
                                          saveCell(e.target.value);
                                        }}
                                        style={{
                                          width: "100%",
                                          padding: "4px",
                                          background: "#0d1117",
                                          border: "1px solid #6366f1",
                                          borderRadius: "4px",
                                          color: "#cbd5e1",
                                          fontSize: "12px",
                                          outline: "none",
                                        }}
                                      >
                                        <option value="">-- None --</option>
                                        {(col.settings?.options || []).map((opt: any) => (
                                          <option key={opt.id} value={opt.id}>
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                    ) : col.type === "PERSON" ? (
                                      <select
                                        autoFocus
                                        value={editingCellValue}
                                        onChange={(e) => {
                                          setEditingCellValue(e.target.value);
                                          saveCell(e.target.value);
                                        }}
                                        style={{
                                          width: "100%",
                                          padding: "4px",
                                          background: "#0d1117",
                                          border: "1px solid #6366f1",
                                          borderRadius: "4px",
                                          color: "#cbd5e1",
                                          fontSize: "12px",
                                          outline: "none",
                                        }}
                                      >
                                        <option value="">-- Unassigned --</option>
                                        {serverMembers.map((member) => (
                                          <option key={member.id} value={member.id}>
                                            {member.name}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input value={editingCellValue} readOnly />
                                    )
                                  ) : (col.type === "STATUS" || col.type === "PRIORITY") && cellData ? (
                                    (() => {
                                      const optId = cellData.optionId || cellData.statusId;
                                      if (!optId) return getDisplayValue();
                                      const options = col.settings?.options || [];
                                      const opt = options.find((o: any) => o.id === optId);
                                      if (!opt) return getDisplayValue();
                                      const defaultColor = col.type === "STATUS" ? "#6b7280" : "#9ca3af";
                                      return <span style={{ background: opt.color || defaultColor, color: "#fff", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 500, display: "inline-block", whiteSpace: "nowrap" }}>{opt.label}</span>;
                                    })()
                                  ) : (
                                    getDisplayValue()
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ padding: "16px", color: "#9ca3af" }}>Loading table...</p>
          )}
        </div>
      ) : (
        /* Kanban Board View */
        <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "flex-start",
            overflowX: "auto",
            paddingBottom: "24px",
          }}
        >
          {board.columns.map((column) => (
            <div
              key={column.id}
              style={{
                flexShrink: 0,
                width: "272px",
                background: "#161d2a",
                border: "1px solid #252f42",
                borderRadius: "14px",
                padding: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "14px",
                }}
              >
                <h3
                  style={{
                    color: "#9ca3af",
                    fontSize: "12px",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    margin: 0,
                    flex: 1,
                  }}
                >
                  {column.name}
                </h3>
                <span
                  style={{
                    background: "#252f42",
                    color: "#6b7280",
                    fontSize: "12px",
                    fontWeight: 500,
                    padding: "2px 8px",
                    borderRadius: "20px",
                    lineHeight: "1.6",
                  }}
                >
                  {column.tasks.length}
                </span>
              </div>

              <DroppableColumn id={column.id}>
                <SortableContext
                  items={column.tasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {column.tasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </SortableContext>
              </DroppableColumn>

              {activeColumnId === column.id ? (
                <div style={{ marginTop: "8px" }}>
                  <input
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createTask(column.id)}
                    placeholder="Task title..."
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
                      marginBottom: "8px",
                      transition: "border-color 0.15s ease",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#252f42")}
                  />
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => createTask(column.id)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#fff",
                        background: "#6366f1",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#7c7ff2")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#6366f1")}
                    >
                      Add task
                    </button>
                    <button
                      onClick={() => { setActiveColumnId(null); setNewTaskTitle(""); }}
                      style={{
                        padding: "8px 12px",
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
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setActiveColumnId(column.id)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    marginTop: "8px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#6b7280",
                    background: "transparent",
                    border: "1px dashed #252f42",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "border-color 0.15s ease, color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#6366f1";
                    e.currentTarget.style.color = "#6366f1";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#252f42";
                    e.currentTarget.style.color = "#6b7280";
                  }}
                >
                  + Add task
                </button>
              )}
            </div>
          ))}
        </div>
      </DndContext>
      )}
    </main>
  );
}
