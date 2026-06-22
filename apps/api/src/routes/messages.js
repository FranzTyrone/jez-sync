"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageRoutes = messageRoutes;
const fastify_1 = require("fastify");
const prisma_1 = require("../lib/prisma");
async function messageRoutes(app) {
    app.get("/channels/:channelId/messages", async (request) => {
        const { channelId } = request.params;
        const { userId } = request.query;
        const messages = await prisma_1.prisma.message.findMany({
            where: { channelId },
            include: {
                author: { select: { id: true, name: true } },
                reactions: true,
            },
            orderBy: { createdAt: "asc" },
            take: 50,
        });
        // Aggregate reactions with userReacted boolean computed server-side
        return messages.map((msg) => {
            const reactionMap = new Map();
            for (const reaction of msg.reactions) {
                if (!reactionMap.has(reaction.emoji)) {
                    reactionMap.set(reaction.emoji, { count: 0, userIds: new Set() });
                }
                const entry = reactionMap.get(reaction.emoji);
                entry.count += 1;
                entry.userIds.add(reaction.userId);
            }
            return {
                id: msg.id,
                content: msg.deletedAt ? null : msg.content,
                authorId: msg.authorId,
                author: msg.author,
                channelId: msg.channelId,
                taskId: msg.taskId,
                createdAt: msg.createdAt,
                editedAt: msg.editedAt,
                deletedAt: msg.deletedAt,
                reactions: Array.from(reactionMap.entries()).map(([emoji, data]) => ({
                    emoji,
                    count: data.count,
                    userReacted: userId ? data.userIds.has(userId) : false,
                })),
            };
        });
    });
}
//# sourceMappingURL=messages.js.map