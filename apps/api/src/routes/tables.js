"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tableRoutes = tableRoutes;
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../lib/auth");
async function tableRoutes(app) {
    // Helper: resolve and authorize (userId must be creator or server owner)
    async function authorize(userId, boardId, reply) {
        const board = await prisma_1.prisma.board.findUnique({
            where: { id: boardId },
            select: { serverId: true, createdById: true },
        });
        if (!board) {
            return reply.status(404).send({ error: "Board not found" });
        }
        const server = await prisma_1.prisma.server.findUnique({
            where: { id: board.serverId },
            select: { ownerId: true },
        });
        if (!server) {
            return reply.status(404).send({ error: "Server not found" });
        }
        const isCreator = userId === board.createdById;
        const isOwner = userId === server.ownerId;
        if (!isCreator && !isOwner) {
            return reply.status(403).send({ error: "Not authorized" });
        }
        return { board, server, authorized: true };
    }
    // POST /boards/:boardId/groups - create group
    app.post("/boards/:boardId/groups", { preHandler: auth_1.authenticateRequest }, async (request, reply) => {
        const { boardId } = request.params;
        const { name } = request.body;
        const userId = request.user?.id;
        if (!userId)
            return reply.status(401).send({ error: "Unauthorized" });
        const auth = await authorize(userId, boardId, reply);
        if (!auth.authorized)
            return;
        const lastGroup = await prisma_1.prisma.group.findFirst({
            where: { boardId },
            orderBy: { position: "desc" },
            select: { position: true },
        });
        const group = await prisma_1.prisma.group.create({
            data: {
                name,
                boardId,
                position: (lastGroup?.position ?? -1) + 1,
            },
        });
        return reply.status(201).send(group);
    });
    // PATCH /groups/:groupId - rename group
    app.patch("/groups/:groupId", { preHandler: auth_1.authenticateRequest }, async (request, reply) => {
        const { groupId } = request.params;
        const { name } = request.body;
        const userId = request.user?.id;
        if (!userId)
            return reply.status(401).send({ error: "Unauthorized" });
        const group = await prisma_1.prisma.group.findUnique({
            where: { id: groupId },
            select: { boardId: true },
        });
        if (!group)
            return reply.status(404).send({ error: "Group not found" });
        const auth = await authorize(userId, group.boardId, reply);
        if (!auth.authorized)
            return;
        const updated = await prisma_1.prisma.group.update({
            where: { id: groupId },
            data: { name },
        });
        return updated;
    });
    // DELETE /groups/:groupId - delete group
    app.delete("/groups/:groupId", { preHandler: auth_1.authenticateRequest }, async (request, reply) => {
        const { groupId } = request.params;
        const userId = request.user?.id;
        if (!userId)
            return reply.status(401).send({ error: "Unauthorized" });
        const group = await prisma_1.prisma.group.findUnique({
            where: { id: groupId },
            select: { boardId: true },
        });
        if (!group)
            return reply.status(404).send({ error: "Group not found" });
        const auth = await authorize(userId, group.boardId, reply);
        if (!auth.authorized)
            return;
        await prisma_1.prisma.group.delete({ where: { id: groupId } });
        return { success: true };
    });
    // POST /boards/:boardId/items - create item (row)
    app.post("/boards/:boardId/items", { preHandler: auth_1.authenticateRequest }, async (request, reply) => {
        const { boardId } = request.params;
        const { title, groupId } = request.body;
        const userId = request.user?.id;
        if (!userId)
            return reply.status(401).send({ error: "Unauthorized" });
        const auth = await authorize(userId, boardId, reply);
        if (!auth.authorized)
            return;
        const lastItem = await prisma_1.prisma.tableItem.findFirst({
            where: { boardId, groupId: groupId || null },
            orderBy: { position: "desc" },
            select: { position: true },
        });
        const item = await prisma_1.prisma.tableItem.create({
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
    app.delete("/items/:itemId", { preHandler: auth_1.authenticateRequest }, async (request, reply) => {
        const { itemId } = request.params;
        const userId = request.user?.id;
        if (!userId)
            return reply.status(401).send({ error: "Unauthorized" });
        const item = await prisma_1.prisma.tableItem.findUnique({
            where: { id: itemId },
            select: { boardId: true },
        });
        if (!item)
            return reply.status(404).send({ error: "Item not found" });
        const auth = await authorize(userId, item.boardId, reply);
        if (!auth.authorized)
            return;
        await prisma_1.prisma.tableItem.delete({ where: { id: itemId } });
        return { success: true };
    });
    // POST /boards/:boardId/columns - create column definition
    app.post("/boards/:boardId/columns", { preHandler: auth_1.authenticateRequest }, async (request, reply) => {
        const { boardId } = request.params;
        const { name, type, settings } = request.body;
        const userId = request.user?.id;
        if (!userId)
            return reply.status(401).send({ error: "Unauthorized" });
        const auth = await authorize(userId, boardId, reply);
        if (!auth.authorized)
            return;
        const lastCol = await prisma_1.prisma.columnDefinition.findFirst({
            where: { boardId },
            orderBy: { position: "desc" },
            select: { position: true },
        });
        const column = await prisma_1.prisma.columnDefinition.create({
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
    app.delete("/columns/:columnId", { preHandler: auth_1.authenticateRequest }, async (request, reply) => {
        const { columnId } = request.params;
        const userId = request.user?.id;
        if (!userId)
            return reply.status(401).send({ error: "Unauthorized" });
        const column = await prisma_1.prisma.columnDefinition.findUnique({
            where: { id: columnId },
            select: { boardId: true },
        });
        if (!column)
            return reply.status(404).send({ error: "Column not found" });
        const auth = await authorize(userId, column.boardId, reply);
        if (!auth.authorized)
            return;
        await prisma_1.prisma.columnDefinition.delete({ where: { id: columnId } });
        return { success: true };
    });
    // POST /cells - upsert cell value
    app.post("/cells", { preHandler: auth_1.authenticateRequest }, async (request, reply) => {
        const { itemId, columnId, value } = request.body;
        const userId = request.user?.id;
        if (!userId)
            return reply.status(401).send({ error: "Unauthorized" });
        // Resolve and authorize
        const item = await prisma_1.prisma.tableItem.findUnique({
            where: { id: itemId },
            select: { boardId: true },
        });
        if (!item)
            return reply.status(404).send({ error: "Item not found" });
        const column = await prisma_1.prisma.columnDefinition.findUnique({
            where: { id: columnId },
            select: { boardId: true },
        });
        if (!column)
            return reply.status(404).send({ error: "Column not found" });
        if (item.boardId !== column.boardId) {
            return reply.status(400).send({ error: "Item and column must be on same board" });
        }
        const auth = await authorize(userId, item.boardId, reply);
        if (!auth.authorized)
            return;
        // Delete if clearing
        if (!value || (typeof value === "object" && Object.keys(value).length === 0)) {
            await prisma_1.prisma.cellValue.deleteMany({
                where: { itemId, columnId },
            });
            return { success: true, deleted: true };
        }
        // Upsert on (itemId, columnId) constraint
        const cell = await prisma_1.prisma.cellValue.upsert({
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
    app.get("/boards/:boardId/table", async (request, reply) => {
        const { boardId } = request.params;
        const board = await prisma_1.prisma.board.findUnique({
            where: { id: boardId },
            select: { type: true },
        });
        if (!board)
            return reply.status(404).send({ error: "Board not found" });
        if (board.type !== "TABLE")
            return reply.status(400).send({ error: "Board is not a TABLE type" });
        const [groups, items, columns] = await Promise.all([
            prisma_1.prisma.group.findMany({
                where: { boardId },
                orderBy: { position: "asc" },
            }),
            prisma_1.prisma.tableItem.findMany({
                where: { boardId },
                orderBy: { position: "asc" },
            }),
            prisma_1.prisma.columnDefinition.findMany({
                where: { boardId },
                orderBy: { position: "asc" },
            }),
        ]);
        const cells = await prisma_1.prisma.cellValue.findMany({
            where: { boardId },
        });
        // Group cells by itemId for easier access (as plain object, not Map)
        const cellsByItem = {};
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
//# sourceMappingURL=tables.js.map