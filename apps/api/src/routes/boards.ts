import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { checkPermission } from "../lib/permissions";

export async function boardRoutes(app: FastifyInstance) {
  // Get the full board with columns and tasks
  app.get("/servers/:serverId/board", async (request, reply) => {
    const { serverId } = request.params as { serverId: string };

    const board = await prisma.board.findFirst({
      where: { serverId },
      include: {
        columns: {
          orderBy: { position: "asc" },
          include: {
            tasks: {
              orderBy: { position: "asc" },
              include: {
                assignee: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!board) {
      return reply.status(404).send({ error: "Board not found" });
    }

    return board;
  });

  // Create a new task
  app.post("/boards/:boardId/tasks", async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const { userId, serverId, title, description, priority, columnId, assigneeId, dueDate } =
      request.body as {
        userId: string;
        serverId: string;
        title: string;
        description?: string;
        priority?: "LOW" | "MEDIUM" | "HIGH";
        columnId: string;
        assigneeId?: string;
        dueDate?: string;
      };

    const allowed = await checkPermission(userId, serverId, "canManageBoards");
    if (!allowed) {
      return reply.status(403).send({ error: "No permission to manage boards" });
    }

    const lastTask = await prisma.task.findFirst({
      where: { columnId },
      orderBy: { position: "desc" },
    });

    const task = await prisma.task.create({
      data: {
        title,
        description: description ?? null,
        priority: priority ?? "MEDIUM",
        boardId,
        columnId,
        assigneeId: assigneeId ?? null,
        dueDate: dueDate ? new Date(dueDate) : null,
        position: (lastTask?.position ?? -1) + 1,
      },
    });

    return reply.status(201).send(task);
  });

  // Move a task to a different column (drag and drop)
  app.patch("/tasks/:taskId/move", async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const { userId, serverId, columnId, position } = request.body as {
      userId: string;
      serverId: string;
      columnId: string;
      position: number;
    };

    const allowed = await checkPermission(userId, serverId, "canManageBoards");
    if (!allowed) {
      return reply.status(403).send({ error: "No permission to manage boards" });
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: { columnId, position },
    });

    return task;
  });
}