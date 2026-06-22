"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.boardRoutes = boardRoutes;
const prisma_1 = require("../lib/prisma");
const permissions_1 = require("../lib/permissions");
const auth_1 = require("../lib/auth");
async function boardRoutes(app) {
    // Helper: check if user can ACCESS a board (read/write its data)
    async function canAccessBoard(userId, boardId) {
        const board = await prisma_1.prisma.board.findUnique({
            where: { id: boardId },
            select: { id: true, serverId: true, createdById: true, visibility: true },
        });
        if (!board) {
            return { allowed: false };
        }
        const server = await prisma_1.prisma.server.findUnique({
            where: { id: board.serverId },
            select: { id: true, ownerId: true },
        });
        if (!server) {
            return { allowed: false };
        }
        const isCreatorOrOwner = userId === board.createdById || userId === server.ownerId;
        const allowed = board.visibility === "PUBLIC" || isCreatorOrOwner;
        return { allowed, board, server, isCreatorOrOwner };
    }
    // List all boards for a server (summary — no columns/tasks) with server owner
    app.get("/servers/:serverId/boards", { preHandler: auth_1.authenticateRequest }, async (request, reply) => {
        const { serverId } = request.params;
        const userId = request.user?.id;
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        const server = await prisma_1.prisma.server.findUnique({
            where: { id: serverId },
            select: { ownerId: true },
        });
        if (!server) {
            return reply.status(404).send({ error: "Server not found" });
        }
        const allBoards = await prisma_1.prisma.board.findMany({
            where: { serverId },
            orderBy: { createdAt: "asc" },
            include: {
                _count: { select: { tasks: true } },
            },
        });
        // Filter: show board if PUBLIC or if PRIVATE and user is creator/owner
        const boards = allBoards.filter((board) => {
            if (board.visibility === "PUBLIC")
                return true;
            // PRIVATE: only show if user is creator or server owner
            return userId === board.createdById || userId === server.ownerId;
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
        // Any authenticated member can create a board
        const member = await prisma_1.prisma.serverMember.findUnique({
            where: { userId_serverId: { userId, serverId } },
        });
        if (!member) {
            return reply.status(403).send({ error: "Not a member of this server" });
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
    app.get("/boards/:boardId", { preHandler: auth_1.authenticateRequest }, async (request, reply) => {
        const { boardId } = request.params;
        const userId = request.user?.id;
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        // Check visibility
        const access = await canAccessBoard(userId, boardId);
        if (!access.allowed) {
            return reply.status(404).send({ error: "Board not found" });
        }
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
    // Toggle board visibility (only creator or server owner can toggle)
    app.patch("/boards/:boardId/visibility", { preHandler: auth_1.authenticateRequest }, async (request, reply) => {
        const { boardId } = request.params;
        const { visibility } = request.body;
        const userId = request.user?.id;
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        if (!visibility || !["PUBLIC", "PRIVATE"].includes(visibility)) {
            return reply.status(400).send({ error: "Invalid visibility value" });
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
        // Strict check: only creator or server owner can change visibility
        const isCreator = userId === board.createdById;
        const isOwner = userId === server.ownerId;
        if (!isCreator && !isOwner) {
            return reply.status(403).send({ error: "Not authorized to change board visibility" });
        }
        const updated = await prisma_1.prisma.board.update({
            where: { id: boardId },
            data: { visibility },
        });
        return updated;
    });
    // Create a new task on a board
    app.post("/boards/:boardId/tasks", { preHandler: auth_1.authenticateRequest }, async (request, reply) => {
        const { boardId } = request.params;
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
        const { title, description, priority, columnId, assigneeId, dueDate } = request.body;
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
    app.patch("/tasks/:taskId/move", { preHandler: auth_1.authenticateRequest }, async (request, reply) => {
        const { taskId } = request.params;
        const userId = request.user?.id;
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        // Resolve boardId from taskId
        const task = await prisma_1.prisma.task.findUnique({
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
        const { columnId, position } = request.body;
        const updated = await prisma_1.prisma.task.update({
            where: { id: taskId },
            data: { columnId, position },
        });
        return updated;
    });
}
//# sourceMappingURL=boards.js.map