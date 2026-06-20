import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { checkPermission } from "../lib/permissions";

export async function roleRoutes(app: FastifyInstance) {
  app.post("/servers/:serverId/roles", async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const { userId, name, color, permissions } = request.body as {
      userId: string;
      name: string;
      color?: string;
      permissions: Record<string, boolean>;
    };

    const allowed = await checkPermission(userId, serverId, "canManageRoles");
    if (!allowed) {
      return reply.status(403).send({ error: "No permission to manage roles" });
    }

    const role = await prisma.role.create({
      data: {
        name,
        serverId,
        color: color ?? null,
        canManageServer: permissions.canManageServer ?? false,
        canManageChannels: permissions.canManageChannels ?? false,
        canManageRoles: permissions.canManageRoles ?? false,
        canInviteUsers: permissions.canInviteUsers ?? false,
        canManageBoards: permissions.canManageBoards ?? false,
        canJoinVoice: permissions.canJoinVoice ?? true,
        canSendMessages: permissions.canSendMessages ?? true,
        canMuteMembers: permissions.canMuteMembers ?? false,
        canKickMembers: permissions.canKickMembers ?? false,
        canAnnotate: permissions.canAnnotate ?? true,
        isAdmin: false,
      },
    });

    return reply.status(201).send(role);
  });

  app.get("/servers/:serverId/roles", async (request) => {
    const { serverId } = request.params as { serverId: string };
    return prisma.role.findMany({ where: { serverId } });
  });
}