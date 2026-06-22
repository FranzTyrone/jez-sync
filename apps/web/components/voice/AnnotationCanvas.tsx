"use client";

import { useRef, useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";


type Stroke = {
  channelId: string;
  strokeId: string;
  userId: string;
  color: string;
  tool: "pen" | "arrow" | "circle";
  points?: { x: number; y: number }[];
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  cx?: number;
  cy?: number;
  r?: number;
};

type Props = {
  channelId: string;
  canDraw: boolean;
  myColor: string;
  myUserId: string;
  containerWidth: number;
  containerHeight: number;
};

export default function AnnotationCanvas({
  channelId,
  canDraw,
  myColor,
  myUserId,
  containerWidth,
  containerHeight,
}: Props) {
  const socket = getSocket();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef(false);
  const currentPointsRef = useRef<{ x: number; y: number }[]>([]);
  const [tool, setTool] = useState<"pen" | "arrow" | "circle">("pen");
  const startPointRef = useRef<{ x: number; y: number } | null>(null);

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokesRef.current.forEach((s) => renderStroke(ctx, s, canvas));
  }

  function renderStroke(ctx: CanvasRenderingContext2D, s: Stroke, canvas: HTMLCanvasElement) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (s.tool === "pen" && s.points && s.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(s.points[0].x * w, s.points[0].y * h);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x * w, s.points[i].y * h);
      }
      ctx.stroke();
    }

    if (s.tool === "circle" && s.cx !== undefined) {
      ctx.beginPath();
      ctx.arc(s.cx * w, s.cy! * h, s.r! * Math.min(w, h), 0, Math.PI * 2);
      ctx.globalAlpha = 0.15;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
    }

    if (s.tool === "arrow" && s.x1 !== undefined) {
      const x1 = s.x1 * w,
        y1 = s.y1! * h,
        x2 = s.x2! * w,
        y2 = s.y2! * h;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const len = 14;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2 - len * Math.cos(angle - 0.4), y2 - len * Math.sin(angle - 0.4));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - len * Math.cos(angle + 0.4), y2 - len * Math.sin(angle + 0.4));
      ctx.stroke();
    }
  }

  useEffect(() => {
    function onStroke(stroke: Stroke) {
      strokesRef.current.push(stroke);
      redraw();
    }
    function onClearAll() {
      strokesRef.current = [];
      redraw();
    }

    socket.on("annotation:stroke", onStroke);
    socket.on("annotation:clearAll", onClearAll);

    return () => {
      socket.off("annotation:stroke", onStroke);
      socket.off("annotation:clearAll", onClearAll);
    };
  }, []);

  function getRelativePoint(e: React.MouseEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }

  function onMouseDown(e: React.MouseEvent) {
    if (!canDraw) return;
    drawingRef.current = true;
    const pt = getRelativePoint(e);
    startPointRef.current = pt;
    currentPointsRef.current = [pt];
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!drawingRef.current || !canDraw) return;
    const pt = getRelativePoint(e);
    currentPointsRef.current.push(pt);

    redraw();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    if (tool === "pen") {
      renderStroke(ctx, {
        channelId,
        strokeId: "preview",
        userId: myUserId,
        color: myColor,
        tool: "pen",
        points: currentPointsRef.current,
      }, canvas);
    } else if (tool === "arrow" && startPointRef.current) {
      renderStroke(ctx, {
        channelId,
        strokeId: "preview",
        userId: myUserId,
        color: myColor,
        tool: "arrow",
        x1: startPointRef.current.x,
        y1: startPointRef.current.y,
        x2: pt.x,
        y2: pt.y,
      }, canvas);
    } else if (tool === "circle" && startPointRef.current) {
      const dx = pt.x - startPointRef.current.x;
      const dy = pt.y - startPointRef.current.y;
      const r = Math.sqrt(dx * dx + dy * dy);
      renderStroke(ctx, {
        channelId,
        strokeId: "preview",
        userId: myUserId,
        color: myColor,
        tool: "circle",
        cx: startPointRef.current.x,
        cy: startPointRef.current.y,
        r,
      }, canvas);
    }
  }

  function onMouseUp() {
    if (!drawingRef.current || !canDraw) return;
    drawingRef.current = false;

    let stroke: Stroke | null = null;

    if (tool === "pen" && currentPointsRef.current.length > 1) {
      stroke = {
        channelId,
        strokeId: crypto.randomUUID(),
        userId: myUserId,
        color: myColor,
        tool: "pen",
        points: currentPointsRef.current,
      };
    } else if (tool === "arrow" && startPointRef.current) {
      const last = currentPointsRef.current[currentPointsRef.current.length - 1];
      stroke = {
        channelId,
        strokeId: crypto.randomUUID(),
        userId: myUserId,
        color: myColor,
        tool: "arrow",
        x1: startPointRef.current.x,
        y1: startPointRef.current.y,
        x2: last.x,
        y2: last.y,
      };
    } else if (tool === "circle" && startPointRef.current) {
      const last = currentPointsRef.current[currentPointsRef.current.length - 1];
      const dx = last.x - startPointRef.current.x;
      const dy = last.y - startPointRef.current.y;
      const r = Math.sqrt(dx * dx + dy * dy);
      stroke = {
        channelId,
        strokeId: crypto.randomUUID(),
        userId: myUserId,
        color: myColor,
        tool: "circle",
        cx: startPointRef.current.x,
        cy: startPointRef.current.y,
        r,
      };
    }

    if (stroke) {
      strokesRef.current.push(stroke);
      socket.emit("annotation:stroke", stroke);
      redraw();
    }

    currentPointsRef.current = [];
    startPointRef.current = null;
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {canDraw && (
        <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
          <button onClick={() => setTool("pen")} style={{ fontWeight: tool === "pen" ? "bold" : "normal" }}>
            Pen
          </button>
          <button onClick={() => setTool("arrow")} style={{ fontWeight: tool === "arrow" ? "bold" : "normal" }}>
            Arrow
          </button>
          <button onClick={() => setTool("circle")} style={{ fontWeight: tool === "circle" ? "bold" : "normal" }}>
            Circle
          </button>
        </div>
      )}
     <canvas
        ref={canvasRef}
        width={containerWidth}
        height={containerHeight}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: canDraw ? "auto" : "none",
          cursor: canDraw ? "crosshair" : "default",
          zIndex: 10,
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      />
    </div>
  );
}