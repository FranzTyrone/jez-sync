type Permission = "canManageServer" | "canManageChannels" | "canManageRoles" | "canInviteUsers" | "canManageBoards" | "canJoinVoice" | "canSendMessages" | "canMuteMembers" | "canKickMembers" | "canAnnotate" | "isAdmin";
export declare function checkPermission(userId: string, serverId: string, permission: Permission): Promise<boolean>;
export {};
//# sourceMappingURL=permissions.d.ts.map