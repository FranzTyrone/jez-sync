"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleRoutes = roleRoutes;
const fastify_1 = require("fastify");
const prisma_1 = require("../lib/prisma");
const permissions_1 = require("../lib/permissions");
async function roleRoutes(app) {
    app.post("/servers/:serverId/roles", async (request, reply) => {
        const { serverId } = request.params;
        const { userId, name, color, permissions } = request.body;
        const allowed = await (0, permissions_1.checkPermission)(userId, serverId, "canManageRoles");
        if (!allowed) {
            return reply.status(403).send({ error: "No permission to manage roles" });
        }
        const role = await prisma_1.prisma.role.create({
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
        const { serverId } = request.params;
        return prisma_1.prisma.role.findMany({ where: { serverId } });
    });
}
//# sourceMappingURL=roles.js.map