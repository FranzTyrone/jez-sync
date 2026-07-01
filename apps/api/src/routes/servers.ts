import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticateRequest } from "../lib/auth";

export async function serverRoutes(app: FastifyInstance) {
  app.post("/servers", async (request, reply) => {
    const { name, ownerId } = request.body as { name: string; ownerId: string };

    if (!name || name.length < 2 || name.length > 100) {
      return reply.status(400).send({ error: "Invalid server name" });
    }

    if (!ownerId) {
      return reply.status(400).send({ error: "ownerId is required" });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const server = await tx.server.create({
          data: { name, ownerId },
        });

        const ownerRole = await tx.role.create({
          data: {
            name: "Owner",
            serverId: server.id,
            color: "#FFD700",
            canManageServer: true,
            canManageChannels: true,
            canManageRoles: true,
            canInviteUsers: true,
            canManageBoards: true,
            canJoinVoice: true,
            canSendMessages: true,
            canMuteMembers: true,
            canKickMembers: true,
            canAnnotate: true,
            isAdmin: true,
          },
        });

        const general = await tx.channel.create({
          data: { name: "general", type: "TEXT", serverId: server.id, position: 0 },
        });

        await tx.channel.create({
          data: { name: "announcements", type: "TEXT", serverId: server.id, position: 1 },
        });

        await tx.channel.create({
          data: { name: "General", type: "VOICE", serverId: server.id, position: 2 },
        });

        const board = await tx.board.create({
          data: { name: "Main Board", serverId: server.id, createdById: user.id, type: "KANBAN" },
        });

        await Promise.all([
          tx.column.create({ data: { name: "To Do", boardId: board.id, position: 0 } }),
          tx.column.create({ data: { name: "In Progress", boardId: board.id, position: 1 } }),
          tx.column.create({ data: { name: "Review", boardId: board.id, position: 2 } }),
          tx.column.create({ data: { name: "Done", boardId: board.id, position: 3 } }),
        ]);

        await tx.serverMember.create({
          data: { userId: ownerId, serverId: server.id, roleId: ownerRole.id },
        });

        return { serverId: server.id, channelId: general.id, boardId: board.id };
      });

      return reply.status(201).send(result);
    } catch (err) {
      console.error("Failed to create server:", err);
      return reply.status(500).send({ error: "Failed to create server" });
    }
  });

  app.get("/users/:userId/servers", async (request) => {
    const { userId } = request.params as { userId: string };

    const memberships = await prisma.serverMember.findMany({
      where: { userId },
      include: {
        server: {
          include: {
            channels: { orderBy: { position: "asc" } },
          },
        },
      },
    });

    return memberships.map((m) => m.server);
  });

  // Create a channel in a server
  app.post("/servers/:serverId/channels", async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const { name, type } = request.body as { name: string; type?: "TEXT" | "VOICE" };

    if (!name || name.trim().length < 1 || name.trim().length > 50) {
      return reply.status(400).send({ error: "Channel name must be 1–50 characters" });
    }

    const channelType = type === "VOICE" ? "VOICE" : "TEXT";

    try {
      const last = await prisma.channel.findFirst({
        where: { serverId },
        orderBy: { position: "desc" },
        select: { position: true },
      });

      const channel = await prisma.channel.create({
        data: {
          name: name.trim().toLowerCase().replace(/\s+/g, "-"),
          type: channelType,
          serverId,
          position: (last?.position ?? -1) + 1,
        },
      });

      return reply.status(201).send(channel);
    } catch (err) {
      console.error("Failed to create channel:", err);
      return reply.status(500).send({ error: "Failed to create channel" });
    }
  });

  // Delete a channel
  app.delete("/channels/:channelId", async (request, reply) => {
    const { channelId } = request.params as { channelId: string };

    try {
      // Check the server still has at least one channel after deletion
      const channel = await prisma.channel.findUnique({ where: { id: channelId } });
      if (!channel) return reply.status(404).send({ error: "Channel not found" });

      const remaining = await prisma.channel.count({ where: { serverId: channel.serverId } });
      if (remaining <= 1) {
        return reply.status(400).send({ error: "Cannot delete the last channel" });
      }

      await prisma.channel.delete({ where: { id: channelId } });
      return reply.status(204).send();
    } catch (err) {
      console.error("Failed to delete channel:", err);
      return reply.status(500).send({ error: "Failed to delete channel" });
    }
  });

  // Update user profile (name)
  app.patch("/users/:userId/profile", { preHandler: authenticateRequest }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { name } = request.body as { name?: string };

    if (request.user?.id !== userId) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    if (name !== undefined) {
      if (!name.trim() || name.trim().length < 1 || name.trim().length > 50) {
        return reply.status(400).send({ error: "Name must be 1–50 characters" });
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { ...(name !== undefined && { name: name.trim() }) },
      select: { id: true, name: true, email: true },
    });
    return updated;
  });

  // Get all members of a server (for PERSON column dropdown)
  app.get("/servers/:serverId/members", async (request, reply) => {
    const { serverId } = request.params as { serverId: string };

    const members = await prisma.serverMember.findMany({
      where: { serverId },
      select: {
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    return members.map((m) => m.user);
  });
}