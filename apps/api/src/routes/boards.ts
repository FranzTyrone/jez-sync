import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { checkPermission } from "../lib/permissions";
import { authenticateRequest } from "../lib/auth";

export async function boardRoutes(app: FastifyInstance) {
  // Helper: check if user can ACCESS a board (read/write its data)
  async function canAccessBoard(
    userId: string,
    boardId: string
  ): Promise<{
    allowed: boolean;
    canSeeBoard: boolean;
    isLocked: boolean;
    board?: { id: string; serverId: string; createdById: string; visibility: string };
    server?: { id: string; ownerId: string };
    isCreatorOrOwner?: boolean;
  }> {
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true, serverId: true, createdById: true, visibility: true },
    });
    if (!board) {
      return { allowed: false, canSeeBoard: false, isLocked: false };
    }

    const server = await prisma.server.findUnique({
      where: { id: board.serverId },
      select: { id: true, ownerId: true },
    });
    if (!server) {
      return { allowed: false, canSeeBoard: false, isLocked: false };
    }

    const isCreatorOrOwner = userId === board.createdById || userId === server.ownerId;

    // Check if user is in the access list (for PRIVATE boards)
    const inAccessList = board.visibility === "PRIVATE"
      ? await prisma.boardAccess.findUnique({
          where: { boardId_userId: { boardId, userId } }
        })
      : true;

    const allowed = board.visibility === "PUBLIC" || isCreatorOrOwner || !!inAccessList;
    const isLocked = board.visibility === "PRIVATE" && !isCreatorOrOwner && !inAccessList;

    return {
      allowed,
      canSeeBoard: true,  // All members can see private boards (now)
      isLocked,
      board,
      server,
      isCreatorOrOwner
    };
  }
  // List all boards for a server (summary — no columns/tasks) with server owner
  app.get("/servers/:serverId/boards", { preHandler: authenticateRequest }, async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const userId = request.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const server = await prisma.server.findUnique({
      where: { id: serverId },
      select: { ownerId: true },
    });

    if (!server) {
      return reply.status(404).send({ error: "Server not found" });
    }

    const allBoards = await prisma.board.findMany({
      where: { serverId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { tasks: true } },
        accessRequests: {
          where: { userId },  // Check if user has pending request
          select: { status: true }
        }
      },
    });

    // Return ALL boards with access status flags (no filtering)
    const boards = await Promise.all(allBoards.map(async (board: any) => {
      const isCreatorOrOwner = userId === board.createdById || userId === server.ownerId;
      const hasPendingRequest = board.accessRequests.some((r: any) => r.status === "PENDING");

      // Check if user is in BoardAccess for PRIVATE boards
      const inAccessList = board.visibility === "PRIVATE"
        ? await prisma.boardAccess.findUnique({
            where: { boardId_userId: { boardId: board.id, userId } }
          })
        : null;

      return {
        ...board,
        canAccess: board.visibility === "PUBLIC" || isCreatorOrOwner || !!inAccessList,
        isLocked: board.visibility === "PRIVATE" && !isCreatorOrOwner && !inAccessList,
        hasPendingRequest,
      };
    }));

    return { boards, ownerId: server.ownerId };
  });

  // Create a new board with default columns/structure
  app.post("/servers/:serverId/boards", { preHandler: authenticateRequest }, async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const { name, type } = request.body as { name: string; type?: "KANBAN" | "TABLE" };
    const userId = request.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    // Any authenticated member can create a board
    const member = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member) {
      return reply.status(403).send({ error: "Not a member of this server" });
    }

    const boardType = type === "TABLE" ? "TABLE" : "KANBAN";

    let boardData: any = {
      name,
      serverId,
      createdById: userId,
      type: boardType,
    };

    if (boardType === "KANBAN") {
      boardData.columns = {
        create: [
          { name: "To Do",       position: 0 },
          { name: "In Progress", position: 1 },
          { name: "Done",        position: 2 },
        ],
      };
    } else {
      // TABLE board: create default group and column
      boardData.groups = {
        create: [{ name: "Backlog", position: 0 }],
      };
      boardData.columnDefinitions = {
        create: [
          {
            name: "Task",
            type: "TEXT",
            position: 0,
            settings: {},
          },
        ],
      };
    }

    const board = await prisma.board.create({
      data: boardData,
      include: {
        columns: { orderBy: { position: "asc" } },
        groups: { orderBy: { position: "asc" } },
        columnDefinitions: { orderBy: { position: "asc" } },
      },
    });

    return reply.status(201).send(board);
  });

  // Get full board detail with columns and tasks
  app.get("/boards/:boardId", { preHandler: authenticateRequest }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const userId = request.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    // Check visibility
    const access = await canAccessBoard(userId, boardId);
    if (!access.board) {
      return reply.status(404).send({ error: "Board not found" });
    }
    if (!access.allowed) {
      if (access.isLocked) {
        return reply.status(403).send({ error: "Access denied" });
      }
      return reply.status(404).send({ error: "Board not found" });
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
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

  // Delete a board (only creator or server owner can delete)
  app.delete("/boards/:boardId", { preHandler: authenticateRequest }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const userId = request.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { serverId: true, createdById: true },
    });

    if (!board) {
      return reply.status(404).send({ error: "Board not found" });
    }

    const server = await prisma.server.findUnique({
      where: { id: board.serverId },
      select: { ownerId: true },
    });

    if (!server) {
      return reply.status(404).send({ error: "Server not found" });
    }

    const isCreator = userId === board.createdById;
    const isOwner = userId === server.ownerId;

    if (!isCreator && !isOwner) {
      return reply.status(403).send({ error: "Not authorized to delete this board" });
    }

    // Soft-delete: set deletedAt timestamp
    await prisma.board.update({ where: { id: boardId }, data: { deletedAt: new Date() } });

    return { success: true };
  });

  // List soft-deleted boards for a server (board trash)
  app.get("/servers/:serverId/boards/trash", { preHandler: authenticateRequest }, async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const userId = request.user?.id;
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const boards = await prisma.board.findMany({
      where: { serverId, deletedAt: { not: null, gte: thirtyDaysAgo } },
      select: { id: true, name: true, type: true, deletedAt: true, createdById: true },
      orderBy: { deletedAt: "desc" },
    });
    return boards;
  });

  // Restore a soft-deleted board
  app.post("/boards/:boardId/restore", { preHandler: authenticateRequest }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const userId = request.user?.id;
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { serverId: true, createdById: true, deletedAt: true },
    });
    if (!board || !board.deletedAt) return reply.status(404).send({ error: "Board not found in trash" });

    const server = await prisma.server.findUnique({ where: { id: board.serverId }, select: { ownerId: true } });
    if (!server) return reply.status(404).send({ error: "Server not found" });

    if (userId !== board.createdById && userId !== server.ownerId) {
      return reply.status(403).send({ error: "Not authorized" });
    }

    const restored = await prisma.board.update({ where: { id: boardId }, data: { deletedAt: null } });
    return restored;
  });

  // Permanently delete a board from trash
  app.delete("/boards/:boardId/permanent", { preHandler: authenticateRequest }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const userId = request.user?.id;
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { serverId: true, createdById: true, deletedAt: true },
    });
    if (!board || !board.deletedAt) return reply.status(404).send({ error: "Board not found in trash" });

    const server = await prisma.server.findUnique({ where: { id: board.serverId }, select: { ownerId: true } });
    if (!server) return reply.status(404).send({ error: "Server not found" });

    if (userId !== board.createdById && userId !== server.ownerId) {
      return reply.status(403).send({ error: "Not authorized" });
    }

    await prisma.task.deleteMany({ where: { boardId } });
    await prisma.column.deleteMany({ where: { boardId } });
    await prisma.board.delete({ where: { id: boardId } });
    return { success: true };
  });

  // Toggle board visibility (only creator or server owner can toggle)
  app.patch("/boards/:boardId/visibility", { preHandler: authenticateRequest }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const { visibility } = request.body as { visibility: "PUBLIC" | "PRIVATE" };
    const userId = request.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    if (!visibility || !["PUBLIC", "PRIVATE"].includes(visibility)) {
      return reply.status(400).send({ error: "Invalid visibility value" });
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { serverId: true, createdById: true },
    });

    if (!board) {
      return reply.status(404).send({ error: "Board not found" });
    }

    const server = await prisma.server.findUnique({
      where: { id: board.serverId },
      select: { ownerId: true },
    });

    if (!server) {
      return reply.status(404).send({ error: "Server not found" });
    }

    // Strict check: only creator or server owner can change visibility
    const isCreator = userId === board.createdById;
    const isOwner = userId === server.ownerId;

    if (!isCreator && !isOwner) {
      return reply.status(403).send({ error: "Not authorized to change board visibility" });
    }

    const updated = await prisma.board.update({
      where: { id: boardId },
      data: { visibility },
    });

    return updated;
  });

  // POST /boards/:boardId/access/request - Request access to a locked board (any server member)
  app.post("/boards/:boardId/access/request", { preHandler: authenticateRequest }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const userId = request.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    // Check visibility and access
    const access = await canAccessBoard(userId, boardId);
    if (!access.board) {
      return reply.status(404).send({ error: "Board not found" });
    }

    // If user already has access (PUBLIC or in BoardAccess), reject
    if (access.allowed) {
      return reply.status(400).send({ error: "Already have access to this board" });
    }

    // Only locked boards can be requested
    if (!access.isLocked) {
      return reply.status(400).send({ error: "Board is not locked" });
    }

    // UPSERT: no row → create PENDING; DENIED → flip to PENDING; PENDING → no-op
    const request_result = await prisma.boardAccessRequest.upsert({
      where: { boardId_userId: { boardId, userId } },
      create: {
        boardId,
        userId,
        status: "PENDING",
      },
      update: {
        status: "PENDING",  // Flip DENIED → PENDING, or stays PENDING
      },
    });

    return { status: request_result.status };
  });

  // GET /boards/:boardId/access/requests - List pending requests (creator/owner only)
  app.get("/boards/:boardId/access/requests", { preHandler: authenticateRequest }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const userId = request.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { serverId: true, createdById: true },
    });

    if (!board) {
      return reply.status(404).send({ error: "Board not found" });
    }

    const server = await prisma.server.findUnique({
      where: { id: board.serverId },
      select: { ownerId: true },
    });

    if (!server) {
      return reply.status(404).send({ error: "Server not found" });
    }

    // Strict creator-or-owner check
    const isCreator = userId === board.createdById;
    const isOwner = userId === server.ownerId;

    if (!isCreator && !isOwner) {
      return reply.status(403).send({ error: "Not authorized" });
    }

    // List PENDING requests with requester names
    const requests = await prisma.boardAccessRequest.findMany({
      where: { boardId, status: "PENDING" },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return requests.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.name,
      createdAt: r.createdAt,
    }));
  });

  // POST /boards/:boardId/access/requests/:requestId/approve - Approve a request (creator/owner only)
  app.post("/boards/:boardId/access/requests/:requestId/approve", { preHandler: authenticateRequest }, async (request, reply) => {
    const { boardId, requestId } = request.params as { boardId: string; requestId: string };
    const userId = request.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { serverId: true, createdById: true },
    });

    if (!board) {
      return reply.status(404).send({ error: "Board not found" });
    }

    const server = await prisma.server.findUnique({
      where: { id: board.serverId },
      select: { ownerId: true },
    });

    if (!server) {
      return reply.status(404).send({ error: "Server not found" });
    }

    // Strict creator-or-owner check
    const isCreator = userId === board.createdById;
    const isOwner = userId === server.ownerId;

    if (!isCreator && !isOwner) {
      return reply.status(403).send({ error: "Not authorized" });
    }

    // Find the request
    const accessRequest = await prisma.boardAccessRequest.findUnique({
      where: { id: requestId },
    });

    if (!accessRequest || accessRequest.boardId !== boardId) {
      return reply.status(404).send({ error: "Request not found" });
    }

    // Transaction: approve request + add to BoardAccess
    const result = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.boardAccessRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", respondedAt: new Date() },
      });

      const access = await tx.boardAccess.upsert({
        where: { boardId_userId: { boardId, userId: accessRequest.userId } },
        create: {
          boardId,
          userId: accessRequest.userId,
        },
        update: {},
      });

      return { request: updatedRequest, access };
    });

    return { status: result.request.status };
  });

  // POST /boards/:boardId/access/requests/:requestId/deny - Deny a request (creator/owner only)
  app.post("/boards/:boardId/access/requests/:requestId/deny", { preHandler: authenticateRequest }, async (request, reply) => {
    const { boardId, requestId } = request.params as { boardId: string; requestId: string };
    const userId = request.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { serverId: true, createdById: true },
    });

    if (!board) {
      return reply.status(404).send({ error: "Board not found" });
    }

    const server = await prisma.server.findUnique({
      where: { id: board.serverId },
      select: { ownerId: true },
    });

    if (!server) {
      return reply.status(404).send({ error: "Server not found" });
    }

    // Strict creator-or-owner check
    const isCreator = userId === board.createdById;
    const isOwner = userId === server.ownerId;

    if (!isCreator && !isOwner) {
      return reply.status(403).send({ error: "Not authorized" });
    }

    // Find and deny the request
    const accessRequest = await prisma.boardAccessRequest.findUnique({
      where: { id: requestId },
    });

    if (!accessRequest || accessRequest.boardId !== boardId) {
      return reply.status(404).send({ error: "Request not found" });
    }

    const updated = await prisma.boardAccessRequest.update({
      where: { id: requestId },
      data: { status: "DENIED", respondedAt: new Date() },
    });

    return { status: updated.status };
  });

  // Create a new task on a board
  app.post("/boards/:boardId/tasks", { preHandler: authenticateRequest }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const userId = request.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    // Check visibility and authorization first (404 if user can't access/modify board)
    const access = await canAccessBoard(userId, boardId);
    if (!access.allowed) {
      return reply.status(404).send({ error: "Board not found" });
    }

    // User must be creator or owner to create tasks
    if (!access.isCreatorOrOwner) {
      return reply.status(404).send({ error: "Board not found" });
    }

    const { title, description, priority, columnId, assigneeId, dueDate } =
      request.body as {
        title: string;
        description?: string;
        priority?: "LOW" | "MEDIUM" | "HIGH";
        columnId: string;
        assigneeId?: string;
        dueDate?: string;
      };

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
  app.patch("/tasks/:taskId/move", { preHandler: authenticateRequest }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const userId = request.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    // Resolve boardId from taskId
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { boardId: true },
    });
    if (!task) {
      return reply.status(404).send({ error: "Task not found" });
    }

    // Check visibility and authorization first (404 if user can't access/modify board)
    const access = await canAccessBoard(userId, task.boardId);
    if (!access.allowed) {
      return reply.status(404).send({ error: "Board not found" });
    }

    if (!access.isCreatorOrOwner) {
      return reply.status(404).send({ error: "Board not found" });
    }

    const { columnId, position } = request.body as {
      columnId: string;
      position: number;
    };

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { columnId, position },
    });

    return updated;
  });
}
