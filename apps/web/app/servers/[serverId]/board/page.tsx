"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
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
  columns: Column[];
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "#999",
  MEDIUM: "#f0ad4e",
  HIGH: "#d9534f",
};

function TaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: "6px",
        padding: "8px 10px",
        marginBottom: "8px",
        cursor: "grab",
      }}
      {...attributes}
      {...listeners}
    >
      <div style={{ fontSize: "14px", marginBottom: "4px" }}>{task.title}</div>
      <span
        style={{
          fontSize: "11px",
          padding: "2px 6px",
          borderRadius: "10px",
          background: PRIORITY_COLORS[task.priority],
          color: "#fff",
        }}
      >
        {task.priority}
      </span>
    </div>
  );
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef}>{children}</div>;
}

export default function BoardPage() {
  const { data: session } = useSession();
  const params = useParams();
  const serverId = params.serverId as string;

  const [board, setBoard] = useState<Board | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    if (!serverId) return;
    fetch(`http://localhost:3001/servers/${serverId}/board`)
      .then((res) => res.json())
      .then((data: Board) => setBoard(data));
  }, [serverId]);

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
          if (c.id === sourceColumn.id) {
            return { ...c, tasks: c.tasks.filter((t) => t.id !== activeId) };
          }
          if (c.id === targetColumn.id) {
            return { ...c, tasks: [...c.tasks, task] };
          }
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

    await fetch(`http://localhost:3001/tasks/${taskId}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: session.user.id,
        serverId,
        columnId: targetColumn.id,
        position: 0,
      }),
    });

    fetch(`http://localhost:3001/servers/${serverId}/board`)
      .then((res) => res.json())
      .then((data: Board) => setBoard(data));
  }

  async function createTask(columnId: string) {
    if (!newTaskTitle.trim() || !session?.user?.id || !board) return;

    await fetch(`http://localhost:3001/boards/${board.id}/tasks`, {
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

    fetch(`http://localhost:3001/servers/${serverId}/board`)
      .then((res) => res.json())
      .then((data: Board) => setBoard(data));
  }

  if (!session) {
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>You must be logged in. <a href="/login">Log in</a></p>
      </main>
    );
  }

  if (!board) {
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>Loading board...</p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>{board.name}</h1>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: "flex", gap: "16px" }}>
          {board.columns.map((column) => (
            <div
              key={column.id}
              style={{
                minWidth: "240px",
                background: "#f5f5f5",
                borderRadius: "8px",
                padding: "10px",
              }}
            >
              <h3 style={{ marginTop: 0, fontSize: "14px" }}>
                {column.name} ({column.tasks.length})
              </h3>

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
                <div>
                  <input
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createTask(column.id)}
                    placeholder="Task title..."
                    style={{ width: "100%", padding: "6px", marginBottom: "4px" }}
                    autoFocus
                  />
                  <button onClick={() => createTask(column.id)} style={{ fontSize: "12px" }}>
                    Add
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveColumnId(column.id)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    fontSize: "12px",
                    background: "transparent",
                    border: "1px dashed #ccc",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  + Add task
                </button>
              )}
            </div>
          ))}
        </div>
      </DndContext>
    </main>
  );
}