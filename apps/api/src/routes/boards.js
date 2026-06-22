"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.boardRoutes = boardRoutes;
const prisma_1 = require("../lib/prisma");
const permissions_1 = require("../lib/permissions");
const auth_1 = require("../lib/auth");
async function boardRoutes(app) {
    // List all boards for a server (summary — no columns/tasks) with server owner
    app.get("/servers/:serverId/boards", async (request, reply) => {
        const { serverId } = request.params;
        const server = await prisma_1.prisma.server.findUnique({
            where: { id: serverId },
            select: { ownerId: true },
        });
        if (!server) {
            return reply.status(404).send({ error: "Server not found" });
        }
        const boards = await prisma_1.prisma.board.findMany({
            where: { serverId },
            orderBy: { createdAt: "asc" },
            include: {
                _count: { select: { tasks: true } },
            },
        });
        return { boards, ownerId: server.ownerId };
    });
    // Create a new board with default columns/structure
    app.post("/servers/:serverId/boards", { preHandler: auth_1.authenticateRequest }, async (request, reply) => {
        const { serverId } = request.params;
        const { name, type } = request.body;
        const userId = request.user?.id;
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        const allowed = await (0, permissions_1.checkPermission)(userId, serverId, "canManageBoards");
        if (!allowed) {
            return reply.status(403).send({ error: "No permission to manage boards" });
        }
        const boardType = type === "TABLE" ? "TABLE" : "KANBAN";
        let boardData = {
            name,
            serverId,
            createdById: userId,
            type: boardType,
        };
        if (boardType === "KANBAN") {
            boardData.columns = {
                create: [
                    { name: "To Do", position: 0 },
                    { name: "In Progress", position: 1 },
                    { name: "Done", position: 2 },
                ],
            };
        }
        else {
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
        const board = await prisma_1.prisma.board.create({
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
    app.get("/boards/:boardId", async (request, reply) => {
        const { boardId } = request.params;
        const board = await prisma_1.prisma.board.findUnique({
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
    app.delete("/boards/:boardId", { preHandler: auth_1.authenticateRequest }, async (request, reply) => {
        const { boardId } = request.params;
        const userId = request.user?.id;
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
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
            return reply.status(403).send({ error: "Not authorized to delete this board" });
        }
        // Delete in order: tasks → columns → board
        await prisma_1.prisma.task.deleteMany({ where: { boardId } });
        await prisma_1.prisma.column.deleteMany({ where: { boardId } });
        await prisma_1.prisma.board.delete({ where: { id: boardId } });
        return { success: true };
    });
    // Create a new task on a board
    app.post("/boards/:boardId/tasks", async (request, reply) => {
        const { boardId } = request.params;
        const { userId, serverId, title, description, priority, columnId, assigneeId, dueDate } = request.body;
        const allowed = await (0, permissions_1.checkPermission)(userId, serverId, "canManageBoards");
        if (!allowed) {
            return reply.status(403).send({ error: "No permission to manage boards" });
        }
        const lastTask = await prisma_1.prisma.task.findFirst({
            where: { columnId },
            orderBy: { position: "desc" },
        });
        const task = await prisma_1.prisma.task.create({
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
        const { taskId } = request.params;
        const { userId, serverId, columnId, position } = request.body;
        const allowed = await (0, permissions_1.checkPermission)(userId, serverId, "canManageBoards");
        if (!allowed) {
            return reply.status(403).send({ error: "No permission to manage boards" });
        }
        const task = await prisma_1.prisma.task.update({
            where: { id: taskId },
            data: { columnId, position },
        });
        return task;
    });
}
//# sourceMappingURL=boards.js.map