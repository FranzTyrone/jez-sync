"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inviteRoutes = inviteRoutes;
const fastify_1 = require("fastify");
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../lib/prisma");
async function inviteRoutes(app) {
    // Generate a new invite link
    app.post("/servers/:serverId/invites", async (request, reply) => {
        const { serverId } = request.params;
        const { createdBy } = request.body;
        if (!createdBy) {
            return reply.status(400).send({ error: "createdBy is required" });
        }
        const code = crypto_1.default.randomBytes(6).toString("base64url").slice(0, 8);
        const invite = await prisma_1.prisma.invite.create({
            data: {
                code,
                serverId,
                createdBy,
            },
        });
        return reply.status(201).send({
            code: invite.code,
            url: `http://localhost:3000/invite/${invite.code}`,
        });
    });
    // Look up invite details (for the preview page)
    app.get("/invites/:code", async (request, reply) => {
        const { code } = request.params;
        const invite = await prisma_1.prisma.invite.findUnique({
            where: { code },
            include: {
                server: {
                    include: {
                        channels: true,
                        members: true,
                    },
                },
            },
        });
        if (!invite) {
            return reply.status(404).send({ error: "Invite not found" });
        }
        return {
            serverId: invite.serverId,
            serverName: invite.server.name,
            memberCount: invite.server.members.length,
        };
    });
    // Join a server via invite code
    app.post("/invites/:code/join", async (request, reply) => {
        const { code } = request.params;
        const { userId } = request.body;
        if (!userId) {
            return reply.status(400).send({ error: "userId is required" });
        }
        const invite = await prisma_1.prisma.invite.findUnique({
            where: { code },
            include: { server: { include: { channels: true } } },
        });
        if (!invite) {
            return reply.status(404).send({ error: "Invite not found" });
        }
        const existing = await prisma_1.prisma.serverMember.findUnique({
            where: { userId_serverId: { userId, serverId: invite.serverId } },
        });
        if (existing) {
            const general = invite.server.channels.find((c) => c.name === "general");
            return reply.send({ serverId: invite.serverId, channelId: general?.id });
        }
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.serverMember.create({
                data: { userId, serverId: invite.serverId },
            }),
            prisma_1.prisma.invite.update({
                where: { id: invite.id },
                data: { useCount: { increment: 1 } },
            }),
        ]);
        const general = invite.server.channels.find((c) => c.name === "general");
        return reply.send({ serverId: invite.serverId, channelId: general?.id });
    });
}
//# sourceMappingURL=invites.js.map