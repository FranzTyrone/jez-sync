import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

export async function messageRoutes(app: FastifyInstance) {
  app.get("/channels/:channelId/messages", async (request) => {
    const { channelId } = request.params as { channelId: string };

    const messages = await prisma.message.findMany({
      where: { channelId },
      include: {
        author: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    return messages;
  });
}