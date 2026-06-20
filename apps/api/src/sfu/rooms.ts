import * as mediasoup from "mediasoup";
import { getWorker } from "./worker";
import { mediaCodecs } from "./config";

type Room = {
  router: mediasoup.types.Router;
  peers: Map<string, mediasoup.types.WebRtcTransport[]>;
};

const rooms = new Map<string, Room>();

export async function getOrCreateRoom(channelId: string): Promise<Room> {
  let room = rooms.get(channelId);

  if (!room) {
    const worker = getWorker();
    const router = await worker.createRouter({ mediaCodecs });

    room = { router, peers: new Map() };
    rooms.set(channelId, room);

    console.log(`Created mediasoup Router for channel ${channelId}`);
  }

  return room;
}

export function getRoom(channelId: string): Room | undefined {
  return rooms.get(channelId);
}

export function removeRoom(channelId: string) {
  const room = rooms.get(channelId);
  if (room) {
    room.router.close();
    rooms.delete(channelId);
    console.log(`Closed mediasoup Router for channel ${channelId}`);
  }
}

export async function createWebRtcTransport(channelId: string) {
  const room = await getOrCreateRoom(channelId);

  const transport = await room.router.createWebRtcTransport({
    listenIps: [{ ip: "0.0.0.0", announcedIp: "127.0.0.1" }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });

  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    },
  };
}

export async function createConsumer(
  channelId: string,
  transport: mediasoup.types.WebRtcTransport,
  producerId: string,
  rtpCapabilities: mediasoup.types.RtpCapabilities
) {
  const room = await getOrCreateRoom(channelId);

  if (!room.router.canConsume({ producerId, rtpCapabilities })) {
    throw new Error("Cannot consume this producer");
  }

  const consumer = await transport.consume({
    producerId,
    rtpCapabilities,
    paused: false,
  });

  return {
    consumer,
    params: {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    },
  };
}

type AnnotationState = {
  sharerId: string;
  grantedSocketIds: Set<string>;
};

const annotationStates = new Map<string, AnnotationState>();

export function startAnnotationSession(channelId: string, sharerSocketId: string) {
  annotationStates.set(channelId, {
    sharerId: sharerSocketId,
    grantedSocketIds: new Set(),
  });
}

export function grantAnnotation(channelId: string, socketId: string) {
  const state = annotationStates.get(channelId);
  if (state) state.grantedSocketIds.add(socketId);
}

export function revokeAnnotation(channelId: string, socketId: string) {
  const state = annotationStates.get(channelId);
  if (state) state.grantedSocketIds.delete(socketId);
}

export function canAnnotate(channelId: string, socketId: string): boolean {
  const state = annotationStates.get(channelId);
  if (!state) return false;
  return state.grantedSocketIds.has(socketId);
}

export function endAnnotationSession(channelId: string) {
  annotationStates.delete(channelId);
}