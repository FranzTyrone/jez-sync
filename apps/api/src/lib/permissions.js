"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPermission = checkPermission;
const prisma_1 = require("./prisma");
async function checkPermission(userId, serverId, permission) {
    const server = await prisma_1.prisma.server.findUnique({ where: { id: serverId } });
    if (server?.ownerId === userId)
        return true;
    const member = await prisma_1.prisma.serverMember.findUnique({
        where: { userId_serverId: { userId, serverId } },
        include: { role: true },
    });
    if (!member)
        return false;
    if (!member.role)
        return false;
    if (member.role.isAdmin)
        return true;
    return member.role[permission] === true;
}
//# sourceMappingURL=permissions.js.map