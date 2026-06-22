import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

export async function messageRoutes(app: FastifyInstance) {
  app.get("/channels/:channelId/messages", async (request) => {
    const { channelId } = request.params as { channelId: string };
    const { userId } = request.query as { userId?: string };

    const messages = await prisma.message.findMany({
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
      const reactionMap = new Map<string, { count: number; userIds: Set<string> }>();
      for (const reaction of msg.reactions) {
        if (!reactionMap.has(reaction.emoji)) {
          reactionMap.set(reaction.emoji, { count: 0, userIds: new Set() });
        }
        const entry = reactionMap.get(reaction.emoji)!;
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