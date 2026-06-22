import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticateRequest } from "../lib/auth";

export async function tableRoutes(app: FastifyInstance) {
  // Helper: check if user can ACCESS a board (read/write its data)
  // Returns true if board is PUBLIC or if PRIVATE and user is creator/owner
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

  // Helper: resolve and authorize (userId must be creator or server owner)
  // Used for write operations that require full control, not just access
  async function authorize(userId: string, boardId: string, reply: any) {
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { serverId: true, createdById: true, visibility: true },
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

    // Check visibility: if PRIVATE and user isn't creator/owner, reject with 404
    if (board.visibility === "PRIVATE" && !isCreator && !isOwner) {
      return reply.status(404).send({ error: "Board not found" });
    }

    if (!isCreator && !isOwner) {
      return reply.status(404).send({ error: "Not authorized to modify this board" });
    }
    return { board, server, authorized: true };
  }

  // Helper for write operations: allow creator/owner OR approved users
  async function authorizeForWrite(userId: string, boardId: string, reply: any) {
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { serverId: true, createdById: true, visibility: true },
    });

    if (!board) {
      reply.status(404).send({ error: "Board not found" });
      return null;
    }

    const server = await prisma.server.findUnique({
      where: { id: board.serverId },
      select: { ownerId: true },
    });

    if (!server) {
      reply.status(404).send({ error: "Server not found" });
      return null;
    }

    const isCreator = userId === board.createdById;
    const isOwner = userId === server.ownerId;

    // For PRIVATE boards, also check if user is in BoardAccess
    const inAccessList = board.visibility === "PRIVATE"
      ? await prisma.boardAccess.findUnique({
          where: { boardId_userId: { boardId, userId } }
        })
      : true;

    const canWrite = isCreator || isOwner || !!inAccessList;

    if (!canWrite) {
      reply.status(403).send({ error: "Not authorized to modify this board" });
      return null;
    }

    return { board, server, authorized: true };
  }

  // POST /boards/:boardId/groups - create group
  app.post("/boards/:boardId/groups", { preHandler: authenticateRequest }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const userId = request.user?.id;

    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const auth = await authorizeForWrite(userId, boardId, reply);
    if (!auth) return;

    const { name } = request.body as { name: string };

    const lastGroup = await prisma.group.findFirst({
      where: { boardId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const group = await prisma.group.create({
      data: {
        name,
        boardId,
        position: (lastGroup?.position ?? -1) + 1,
      },
    });

    return reply.status(201).send(group);
  });

  // PATCH /groups/:groupId - rename group
  app.patch("/groups/:groupId", { preHandler: authenticateRequest }, async (request, reply) => {
    const { groupId } = request.params as { groupId: string };
    const userId = request.user?.id;

    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { boardId: true },
    });
    if (!group) return reply.status(404).send({ error: "Group not found" });

    const auth = await authorize(userId, group.boardId, reply);
    if (!auth) return;

    const { name } = request.body as { name: string };

    const updated = await prisma.group.update({
      where: { id: groupId },
      data: { name },
    });

    return updated;
  });

  // DELETE /groups/:groupId - delete group
  app.delete("/groups/:groupId", { preHandler: authenticateRequest }, async (request, reply) => {
    const { groupId } = request.params as { groupId: string };
    const userId = request.user?.id;

    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { boardId: true },
    });
    if (!group) return reply.status(404).send({ error: "Group not found" });

    const auth = await authorize(userId, group.boardId, reply);
    if (!auth) return;

    await prisma.group.delete({ where: { id: groupId } });
    return { success: true };
  });

  // POST /boards/:boardId/items - create item (row)
  app.post("/boards/:boardId/items", { preHandler: authenticateRequest }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const userId = request.user?.id;

    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const auth = await authorizeForWrite(userId, boardId, reply);
    if (!auth) return;

    const { title, groupId } = request.body as { title: string; groupId?: string };

    const lastItem = await prisma.tableItem.findFirst({
      where: { boardId, groupId: groupId || null },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const item = await prisma.tableItem.create({
      data: {
        title,
        boardId,
        groupId: groupId || null,
        position: (lastItem?.position ?? -1) + 1,
      },
    });

    return reply.status(201).send(item);
  });

  // DELETE /items/:itemId - delete item
  app.delete("/items/:itemId", { preHandler: authenticateRequest }, async (request, reply) => {
    const { itemId } = request.params as { itemId: string };
    const userId = request.user?.id;

    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const item = await prisma.tableItem.findUnique({
      where: { id: itemId },
      select: { boardId: true },
    });
    if (!item) return reply.status(404).send({ error: "Item not found" });

    const auth = await authorize(userId, item.boardId, reply);
    if (!auth) return;

    await prisma.tableItem.delete({ where: { id: itemId } });
    return { success: true };
  });

  // POST /boards/:boardId/columns - create column definition
  app.post("/boards/:boardId/columns", { preHandler: authenticateRequest }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const userId = request.user?.id;

    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const auth = await authorizeForWrite(userId, boardId, reply);
    if (!auth) return;

    const { name, type, settings } = request.body as {
      name: string;
      type: "TEXT" | "STATUS";
      settings?: Record<string, any>;
    };

    const lastCol = await prisma.columnDefinition.findFirst({
      where: { boardId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const column = await prisma.columnDefinition.create({
      data: {
        name,
        type,
        boardId,
        position: (lastCol?.position ?? -1) + 1,
        settings: settings || {},
      },
    });

    return reply.status(201).send(column);
  });

  // DELETE /columns/:columnId - delete column
  app.delete("/columns/:columnId", { preHandler: authenticateRequest }, async (request, reply) => {
    const { columnId } = request.params as { columnId: string };
    const userId = request.user?.id;

    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const column = await prisma.columnDefinition.findUnique({
      where: { id: columnId },
      select: { boardId: true },
    });
    if (!column) return reply.status(404).send({ error: "Column not found" });

    const auth = await authorize(userId, column.boardId, reply);
    if (!auth) return;

    await prisma.columnDefinition.delete({ where: { id: columnId } });
    return { success: true };
  });

  // POST /cells - upsert cell value
  app.post("/cells", { preHandler: authenticateRequest }, async (request, reply) => {
    const { itemId, columnId } = request.body as {
      itemId: string;
      columnId: string;
      value?: Record<string, any> | null;
    };
    const userId = request.user?.id;

    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    // Resolve and authorize
    const item = await prisma.tableItem.findUnique({
      where: { id: itemId },
      select: { boardId: true },
    });
    if (!item) return reply.status(404).send({ error: "Item not found" });

    const column = await prisma.columnDefinition.findUnique({
      where: { id: columnId },
      select: { boardId: true },
    });
    if (!column) return reply.status(404).send({ error: "Column not found" });

    if (item.boardId !== column.boardId) {
      return reply.status(400).send({ error: "Item and column must be on same board" });
    }

    const auth = await authorize(userId, item.boardId, reply);
    if (!auth) return;

    const { value } = request.body;

    // Delete if clearing
    if (!value || (typeof value === "object" && Object.keys(value).length === 0)) {
      await prisma.cellValue.deleteMany({
        where: { itemId, columnId },
      });
      return { success: true, deleted: true };
    }

    // Upsert on (itemId, columnId) constraint
    const cell = await prisma.cellValue.upsert({
      where: { itemId_columnId: { itemId, columnId } },
      create: {
        itemId,
        columnId,
        boardId: item.boardId,
        value,
      },
      update: {
        value,
        updatedAt: new Date(),
      },
    });

    return cell;
  });

  // GET /boards/:boardId/table - fetch full table (groups, items, columns, cells)
  app.get("/boards/:boardId/table", { preHandler: authenticateRequest }, async (request, reply) => {
    const { boardId } = request.params as { boardId: string };
    const userId = request.user?.id;

    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    // Check visibility
    const access = await canAccessBoard(userId, boardId);
    if (!access.board) return reply.status(404).send({ error: "Board not found" });
    if (!access.allowed) {
      if (access.isLocked) {
        return reply.status(403).send({ error: "Access denied" });
      }
      return reply.status(404).send({ error: "Board not found" });
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { type: true },
    });
    if (!board) return reply.status(404).send({ error: "Board not found" });
    if (board.type !== "TABLE") return reply.status(400).send({ error: "Board is not a TABLE type" });

    const [groups, items, columns] = await Promise.all([
      prisma.group.findMany({
        where: { boardId },
        orderBy: { position: "asc" },
      }),
      prisma.tableItem.findMany({
        where: { boardId },
        orderBy: { position: "asc" },
      }),
      prisma.columnDefinition.findMany({
        where: { boardId },
        orderBy: { position: "asc" },
      }),
    ]);

    const cells = await prisma.cellValue.findMany({
      where: { boardId },
    });

    // Group cells by itemId for easier access (as plain object, not Map)
    const cellsByItem: Record<string, Record<string, any>> = {};
    for (const cell of cells) {
      if (!cellsByItem[cell.itemId]) {
        cellsByItem[cell.itemId] = {};
      }
      cellsByItem[cell.itemId][cell.columnId] = cell.value;
    }

    return {
      groups,
      items,
      columns,
      cells: cellsByItem,
    };
  });
}
