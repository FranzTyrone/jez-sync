import { prisma } from "./prisma";

type Permission =
  | "canManageServer"
  | "canManageChannels"
  | "canManageRoles"
  | "canInviteUsers"
  | "canManageBoards"
  | "canJoinVoice"
  | "canSendMessages"
  | "canMuteMembers"
  | "canKickMembers"
  | "canAnnotate"
  | "isAdmin";

export async function checkPermission(
  userId: string,
  serverId: string,
  permission: Permission
): Promise<boolean> {
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (server?.ownerId === userId) return true;

  const member = await prisma.serverMember.findUnique({
    where: { userId_serverId: { userId, serverId } },
    include: { role: true },
  });

  if (!member) return false;
  if (!member.role) return false;
  if (member.role.isAdmin) return true;

  return member.role[permission] === true;
}