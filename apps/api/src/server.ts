import Fastify from "fastify";
import { Server } from "socket.io";
import { prisma } from "./lib/prisma";
import { authenticateRequest } from "./lib/auth";
import { messageRoutes } from "./routes/messages";
import { serverRoutes } from "./routes/servers";
import { inviteRoutes } from "./routes/invites";
import { roleRoutes } from "./routes/roles";
import { boardRoutes } from "./routes/boards";
import { tableRoutes } from "./routes/tables";
import { createWorker } from "./sfu/worker";
import {
  getOrCreateRoom,
  createWebRtcTransport,
  createConsumer,
  startAnnotationSession,
  grantAnnotation,
  revokeAnnotation,
  canAnnotate,
  endAnnotationSession,
} from "./sfu/rooms";

const app = Fastify({ logger: true });
const activeVoiceUsers = new Map<string, string>();

// ─── Music room state ─────────────────────────────────────────
interface MusicItem {
  id: string;
  videoId: string;
  title: string;
  thumbnail: string;
  addedBy: string;
  duration?: string;
}
interface MusicRoomState {
  queue: MusicItem[];
  currentIndex: number;
  startedAt: number | null;
  paused: boolean;
  pausedAt: number;
}
const musicRooms = new Map<string, MusicRoomState>();
function getMusicRoom(channelId: string): MusicRoomState {
  if (!musicRooms.has(channelId)) {
    musicRooms.set(channelId, { queue: [], currentIndex: 0, startedAt: null, paused: false, pausedAt: 0 });
  }
  return musicRooms.get(channelId)!;
}
function broadcastMusicState(io: Server, channelId: string) {
  const state = getMusicRoom(channelId);
  io.to(`voice:${channelId}`).emit("music:state", {
    queue: state.queue,
    currentIndex: state.currentIndex,
    startedAt: state.startedAt,
    paused: state.paused,
    pausedAt: state.pausedAt,
  });
  // Lightweight global broadcast so clients that aren't in the voice room
  // (e.g. the server sidebar) can still show the music bot as active.
  const current = state.queue[state.currentIndex];
  io.emit("music:activeChanged", {
    channelId,
    active: !!current && !state.paused,
    title: current?.title ?? null,
  });
}

// Get allowed origins from env or default to localhost
function getAllowedOrigins(): string | RegExp | (string | RegExp)[] {
  const corsOrigins = process.env.CORS_ORIGINS || "http://localhost:3000";
  // If comma-separated, return as array
  if (corsOrigins.includes(",")) {
    return corsOrigins.split(",").map(o => o.trim());
  }
  return corsOrigins;
}

app.get("/health", async () => {
  return { status: "ok", service: "jez-sync-api" };
});

app.register(messageRoutes);
app.register(serverRoutes);
app.register(inviteRoutes);
app.register(roleRoutes);
app.register(boardRoutes);
app.register(tableRoutes);

const start = async () => {
  try {
    // Register cookie support first (needed for auth middleware)
    await app.register(import("@fastify/cookie"));

    const allowedOrigins = getAllowedOrigins();
    await app.register(import("@fastify/cors"), {
      origin: allowedOrigins,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    });

    await app.listen({ port: 3001, host: "0.0.0.0" });
    console.log("API running on http://localhost:3001");
    console.log(`[ENV] GEMINI_API_KEY loaded: ${!!process.env.GEMINI_API_KEY}`);

    try {
      await createWorker();
    } catch (err) {
      console.error("Warning: mediasoup worker failed to start (voice features may be limited):", (err as Error).message);
    }

    const io = new Server(app.server, {
      cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    io.on("connection", (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      socket.on("channel:join", (channelId: string) => {
        socket.join(channelId);
        console.log(`Socket ${socket.id} joined channel ${channelId}`);
      });

      socket.on(
        "message:send",
        async (data: { channelId: string; authorId: string; content: string }) => {
          try {
            const message = await prisma.message.create({
              data: {
                content: data.content,
                authorId: data.authorId,
                channelId: data.channelId,
              },
              include: {
                author: { select: { id: true, name: true } },
              },
            });

            io.to(data.channelId).emit("message:receive", message);
          } catch (err) {
            console.error("Failed to save message:", err);
          }
        }
      );

      socket.on(
        "voice:join",
        async (data: { channelId: string; userName: string; userId: string; userImage?: string | null }, callback) => {
          try {
            const key = `${data.channelId}:${data.userId}`;
            const existingSocketId = activeVoiceUsers.get(key);

            if (existingSocketId && existingSocketId !== socket.id) {
              const oldSocket = io.sockets.sockets.get(existingSocketId);
              if (oldSocket) {
                oldSocket.emit("voice:kicked", { reason: "Reconnected from another tab" });
                oldSocket.disconnect(true);
              }
            }

            const room = await getOrCreateRoom(data.channelId);
            const alreadyInRoom = socket.data.channelId === data.channelId;

            socket.join(`voice:${data.channelId}`);
            socket.data.userName = data.userName;
            socket.data.userId = data.userId;
            socket.data.userImage = data.userImage ?? null;
            socket.data.channelId = data.channelId;
            activeVoiceUsers.set(key, socket.id);

            if (!alreadyInRoom) {
              socket.to(`voice:${data.channelId}`).emit("voice:participantJoined", {
                socketId: socket.id,
                userName: data.userName,
              });
            }

            io.emit("voice:channelParticipantsChanged", { channelId: data.channelId });

            callback({
              rtpCapabilities: room.router.rtpCapabilities,
            });

            console.log(`Socket ${socket.id} joined voice channel ${data.channelId}`);
          } catch (err) {
            console.error("Failed to join voice channel:", err);
            callback({ error: "Failed to join voice channel" });
          }
        }
      );

      socket.on("voice:getParticipants", (data: { channelId: string }, callback) => {
        const socketsInRoom = io.sockets.adapter.rooms.get(`voice:${data.channelId}`);
        const participants: { socketId: string; userName: string }[] = [];

        if (socketsInRoom) {
          for (const socketId of socketsInRoom) {
            if (socketId === socket.id) continue;
            const otherSocket = io.sockets.sockets.get(socketId);
            if (otherSocket?.data.userName) {
              participants.push({ socketId, userName: otherSocket.data.userName });
            }
          }
        }

        callback({ participants });
      });

      socket.on("voice:getChannelParticipants", (data: { channelId: string }, callback) => {
        const socketsInRoom = io.sockets.adapter.rooms.get(`voice:${data.channelId}`);
        const participants: { socketId: string; userName: string; userId?: string; isMuted?: boolean; isDeafened?: boolean }[] = [];

        if (socketsInRoom) {
          for (const socketId of socketsInRoom) {
            const s = io.sockets.sockets.get(socketId);
            if (s?.data.userName) {
              participants.push({
                socketId,
                userName: s.data.userName,
                userId: s.data.userId,
                userImage: s.data.userImage ?? null,
                isMuted: s.data.isMuted ?? false,
                isDeafened: s.data.isDeafened ?? false,
              });
            }
          }
        }

        callback({ participants });
      });

      socket.on(
        "voice:createTransport",
        async (data: { channelId: string }, callback) => {
          try {
            const { transport, params } = await createWebRtcTransport(data.channelId);

            socket.data.transports = socket.data.transports || {};
            socket.data.transports[transport.id] = transport;

            callback({ params });
          } catch (err) {
            console.error("Failed to create transport:", err);
            callback({ error: "Failed to create transport" });
          }
        }
      );

      socket.on(
        "voice:connectTransport",
        async (
          data: { transportId: string; dtlsParameters: any },
          callback
        ) => {
          try {
            const transport = socket.data.transports?.[data.transportId];
            if (!transport) throw new Error("Transport not found");

            await transport.connect({ dtlsParameters: data.dtlsParameters });
            callback({ success: true });
          } catch (err) {
            console.error("Failed to connect transport:", err);
            callback({ error: "Failed to connect transport" });
          }
        }
      );

      socket.on(
        "voice:produce",
        async (
          data: {
            channelId: string;
            transportId: string;
            kind: string;
            rtpParameters: any;
            appData?: { mediaTag?: string };
          },
          callback
        ) => {
          try {
            const transport = socket.data.transports?.[data.transportId];
            if (!transport) throw new Error("Transport not found");

            const producer = await transport.produce({
              kind: data.kind,
              rtpParameters: data.rtpParameters,
              appData: data.appData,
            });

            socket.data.producers = socket.data.producers || {};
            socket.data.producers[producer.id] = {
              producer,
              mediaTag: data.appData?.mediaTag,
            };

            socket.to(`voice:${data.channelId}`).emit("voice:newProducer", {
              producerId: producer.id,
              socketId: socket.id,
              appData: data.appData,
            });

            callback({ id: producer.id });
          } catch (err) {
            console.error("Failed to produce:", err);
            callback({ error: "Failed to produce" });
          }
        }
      );

      socket.on("voice:closeProducer", (data: { channelId: string; producerId: string }) => {
        const entry = socket.data.producers?.[data.producerId];
        if (!entry) return;

        const mediaTag = entry.mediaTag;
        entry.producer.close();
        delete socket.data.producers[data.producerId];

        socket.to(`voice:${data.channelId}`).emit("voice:producerClosed", {
          socketId: socket.id,
          mediaTag,
        });
      });

      socket.on("voice:muteStateChanged", (data: { channelId: string; isMuted: boolean }) => {
        socket.data.isMuted = data.isMuted;
        io.to(`voice:${data.channelId}`).emit("voice:participantMuteChanged", {
          socketId: socket.id,
          isMuted: data.isMuted,
        });
      });

      socket.on("voice:deafenStateChanged", (data: { channelId: string; isDeafened: boolean }) => {
        socket.data.isDeafened = data.isDeafened;
        io.to(`voice:${data.channelId}`).emit("voice:participantDeafenChanged", {
          socketId: socket.id,
          isDeafened: data.isDeafened,
        });
      });

      socket.on(
        "voice:consume",
        async (
          data: {
            channelId: string;
            transportId: string;
            producerId: string;
            rtpCapabilities: any;
          },
          callback
        ) => {
          try {
            const transport = socket.data.transports?.[data.transportId];
            if (!transport) throw new Error("Transport not found");

            const { params } = await createConsumer(
              data.channelId,
              transport,
              data.producerId,
              data.rtpCapabilities
            );

            callback({ params });
          } catch (err) {
            console.error("Failed to consume:", err);
            callback({ error: "Failed to consume" });
          }
        }
      );

      socket.on("voice:getProducers", (data: { channelId: string }, callback) => {
        const socketsInRoom = io.sockets.adapter.rooms.get(`voice:${data.channelId}`);
        const producerList: {
          producerId: string;
          socketId: string;
          appData?: { mediaTag?: string };
        }[] = [];

        if (socketsInRoom) {
          for (const socketId of socketsInRoom) {
            if (socketId === socket.id) continue;
            const otherSocket = io.sockets.sockets.get(socketId);
            if (otherSocket?.data.producers) {
              for (const [producerId, entry] of Object.entries(otherSocket.data.producers) as any) {
                producerList.push({
                  producerId,
                  socketId,
                  appData: { mediaTag: entry.mediaTag },
                });
              }
            }
          }
        }

        callback({ producers: producerList });
      });

      socket.on("annotation:start", (data: { channelId: string }) => {
        startAnnotationSession(data.channelId, socket.id);
        console.log(`Annotation session started by ${socket.id} in ${data.channelId}`);
      });

      socket.on(
        "annotation:request",
        (data: { channelId: string; requesterName: string }) => {
          socket.to(`voice:${data.channelId}`).emit("annotation:requestReceived", {
            channelId: data.channelId,
            requesterSocketId: socket.id,
            requesterName: data.requesterName,
          });
        }
      );

      socket.on(
        "annotation:grant",
        (data: { channelId: string; targetSocketId: string }) => {
          grantAnnotation(data.channelId, data.targetSocketId);
          io.to(data.targetSocketId).emit("annotation:granted", {
            channelId: data.channelId,
          });
        }
      );

      socket.on(
        "annotation:deny",
        (data: { channelId: string; targetSocketId: string }) => {
          io.to(data.targetSocketId).emit("annotation:denied", {
            channelId: data.channelId,
          });
        }
      );

      socket.on(
        "annotation:revoke",
        (data: { channelId: string; targetSocketId: string }) => {
          revokeAnnotation(data.channelId, data.targetSocketId);
          io.to(data.targetSocketId).emit("annotation:revoked");
          socket.to(`voice:${data.channelId}`).emit("annotation:userRevoked", {
            socketId: data.targetSocketId,
          });
        }
      );

      socket.on(
        "annotation:stroke",
        (data: {
          channelId: string;
          strokeId: string;
          tool: string;
          color: string;
          points?: { x: number; y: number }[];
          x1?: number;
          y1?: number;
          x2?: number;
          y2?: number;
          cx?: number;
          cy?: number;
          r?: number;
          x?: number;
          y?: number;
          text?: string;
        }) => {
          if (!canAnnotate(data.channelId, socket.id)) {
            console.log(`Blocked unauthorized stroke from ${socket.id}`);
            return;
          }

          socket.to(`voice:${data.channelId}`).emit("annotation:stroke", data);
        }
      );

      socket.on("annotation:clearAll", (data: { channelId: string }) => {
        io.to(`voice:${data.channelId}`).emit("annotation:clearAll");
      });

      socket.on("annotation:end", (data: { channelId: string }) => {
        endAnnotationSession(data.channelId);
        io.to(`voice:${data.channelId}`).emit("annotation:clearAll");
      });

      // ─── Music room events ──────────────────────────────────────
      socket.on("music:add", (data: { channelId: string; videoId: string; title: string; thumbnail: string; addedBy: string; duration?: string; replyAuthor?: string; replyContent?: string }, callback?: (res: { itemId: string; position: number }) => void) => {
        const room = getMusicRoom(data.channelId);
        const item: MusicItem = { id: `${Date.now()}`, videoId: data.videoId, title: data.title, thumbnail: data.thumbnail, addedBy: data.addedBy, ...(data.duration ? { duration: data.duration } : {}) };
        room.queue.push(item);
        const position = room.queue.length;
        const wasEmpty = position === 1 && room.startedAt === null;
        if (wasEmpty) { room.startedAt = Date.now(); room.paused = false; room.currentIndex = 0; }
        broadcastMusicState(io, data.channelId);
        io.to(`voice:${data.channelId}`).emit("music:announce", {
          itemId: item.id,
          title: item.title,
          thumbnail: item.thumbnail,
          duration: item.duration ?? null,
          position,
          addedBy: item.addedBy,
          replyAuthor: data.replyAuthor ?? item.addedBy,
          replyContent: data.replyContent ?? "",
          timestamp: Date.now(),
        });
        if (callback) callback({ itemId: item.id, position });
      });

      socket.on("music:skip", (data: { channelId: string }) => {
        const room = getMusicRoom(data.channelId);
        room.currentIndex++;
        if (room.currentIndex >= room.queue.length) {
          room.queue = []; room.currentIndex = 0; room.startedAt = null; room.paused = false; room.pausedAt = 0;
        } else {
          room.startedAt = Date.now(); room.paused = false; room.pausedAt = 0;
        }
        broadcastMusicState(io, data.channelId);
      });

      socket.on("music:pause", (data: { channelId: string }) => {
        const room = getMusicRoom(data.channelId);
        if (!room.paused && room.startedAt) {
          room.pausedAt = Date.now() - room.startedAt;
          room.paused = true;
          room.startedAt = null;
        }
        broadcastMusicState(io, data.channelId);
      });

      socket.on("music:resume", (data: { channelId: string }) => {
        const room = getMusicRoom(data.channelId);
        if (room.paused) {
          room.startedAt = Date.now() - room.pausedAt;
          room.paused = false;
        }
        broadcastMusicState(io, data.channelId);
      });

      socket.on("music:remove", (data: { channelId: string; itemId: string }) => {
        const room = getMusicRoom(data.channelId);
        const idx = room.queue.findIndex(q => q.id === data.itemId);
        if (idx === -1) return;
        room.queue.splice(idx, 1);
        if (idx < room.currentIndex) room.currentIndex--;
        else if (idx === room.currentIndex) {
          if (room.currentIndex >= room.queue.length) { room.currentIndex = 0; room.startedAt = null; room.paused = false; }
          else { room.startedAt = Date.now(); room.paused = false; }
        }
        broadcastMusicState(io, data.channelId);
      });

      socket.on("music:getState", (data: { channelId: string }, callback) => {
        const room = getMusicRoom(data.channelId);
        callback({ queue: room.queue, currentIndex: room.currentIndex, startedAt: room.startedAt, paused: room.paused, pausedAt: room.pausedAt });
      });

      socket.on("voice:leave", () => {
        const channelId = socket.data.channelId;
        if (!channelId) return;

        if (socket.data.userId) {
          const key = `${channelId}:${socket.data.userId}`;
          if (activeVoiceUsers.get(key) === socket.id) {
            activeVoiceUsers.delete(key);
          }
        }

        // Close and clear all producers
        if (socket.data.producers) {
          for (const [, entry] of Object.entries(socket.data.producers) as any) {
            try { entry.producer.close(); } catch {}
            socket.to(`voice:${channelId}`).emit("voice:producerClosed", {
              socketId: socket.id,
              mediaTag: entry.mediaTag,
            });
          }
          socket.data.producers = {};
        }

        // Close and clear all transports so next join starts fresh
        if (socket.data.transports) {
          for (const transport of Object.values(socket.data.transports) as any[]) {
            try { transport.close(); } catch {}
          }
          socket.data.transports = {};
        }

        socket.to(`voice:${channelId}`).emit("voice:participantLeft", { socketId: socket.id });
        socket.leave(`voice:${channelId}`);
        socket.data.channelId = null;
        io.emit("voice:channelParticipantsChanged", { channelId });
      });

      socket.on("disconnect", () => {
        console.log(`Socket disconnected: ${socket.id}`);

        if (socket.data.channelId && socket.data.userId) {
          const key = `${socket.data.channelId}:${socket.data.userId}`;
          if (activeVoiceUsers.get(key) === socket.id) {
            activeVoiceUsers.delete(key);
          }
        }

        if (socket.data.channelId && socket.data.producers) {
          for (const [producerId, entry] of Object.entries(socket.data.producers) as any) {
            entry.producer.close();
            socket.to(`voice:${socket.data.channelId}`).emit("voice:producerClosed", {
              socketId: socket.id,
              mediaTag: entry.mediaTag,
            });
          }
        }

        // Close all WebRtcTransports to return their ports to the pool.
        // Without this, every join/leave cycle leaks ports until the range is exhausted.
        if (socket.data.transports) {
          for (const transport of Object.values(socket.data.transports) as any[]) {
            transport.close();
          }
        }

        if (socket.data.channelId) {
          socket.to(`voice:${socket.data.channelId}`).emit("voice:participantLeft", {
            socketId: socket.id,
          });

          endAnnotationSession(socket.data.channelId);
          socket.to(`voice:${socket.data.channelId}`).emit("annotation:clearAll");

          io.emit("voice:channelParticipantsChanged", { channelId: socket.data.channelId });
        }
      });
    });

    console.log("Socket.io attached");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();