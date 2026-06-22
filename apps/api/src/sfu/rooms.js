"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateRoom = getOrCreateRoom;
exports.getRoom = getRoom;
exports.removeRoom = removeRoom;
exports.createWebRtcTransport = createWebRtcTransport;
exports.createConsumer = createConsumer;
exports.startAnnotationSession = startAnnotationSession;
exports.grantAnnotation = grantAnnotation;
exports.revokeAnnotation = revokeAnnotation;
exports.canAnnotate = canAnnotate;
exports.endAnnotationSession = endAnnotationSession;
const mediasoup = __importStar(require("mediasoup"));
const worker_1 = require("./worker");
const config_1 = require("./config");
const rooms = new Map();
async function getOrCreateRoom(channelId) {
    let room = rooms.get(channelId);
    if (!room) {
        const worker = (0, worker_1.getWorker)();
        const router = await worker.createRouter({ mediaCodecs: config_1.mediaCodecs });
        room = { router, peers: new Map() };
        rooms.set(channelId, room);
        console.log(`Created mediasoup Router for channel ${channelId}`);
    }
    return room;
}
function getRoom(channelId) {
    return rooms.get(channelId);
}
function removeRoom(channelId) {
    const room = rooms.get(channelId);
    if (room) {
        room.router.close();
        rooms.delete(channelId);
        console.log(`Closed mediasoup Router for channel ${channelId}`);
    }
}
async function createWebRtcTransport(channelId) {
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
async function createConsumer(channelId, transport, producerId, rtpCapabilities) {
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
const annotationStates = new Map();
function startAnnotationSession(channelId, sharerSocketId) {
    annotationStates.set(channelId, {
        sharerId: sharerSocketId,
        grantedSocketIds: new Set(),
    });
}
function grantAnnotation(channelId, socketId) {
    const state = annotationStates.get(channelId);
    if (state)
        state.grantedSocketIds.add(socketId);
}
function revokeAnnotation(channelId, socketId) {
    const state = annotationStates.get(channelId);
    if (state)
        state.grantedSocketIds.delete(socketId);
}
function canAnnotate(channelId, socketId) {
    const state = annotationStates.get(channelId);
    if (!state)
        return false;
    return state.grantedSocketIds.has(socketId);
}
function endAnnotationSession(channelId) {
    annotationStates.delete(channelId);
}
//# sourceMappingURL=rooms.js.map