import * as mediasoup from "mediasoup";
type Room = {
    router: mediasoup.types.Router;
    peers: Map<string, mediasoup.types.WebRtcTransport[]>;
};
export declare function getOrCreateRoom(channelId: string): Promise<Room>;
export declare function getRoom(channelId: string): Room | undefined;
export declare function removeRoom(channelId: string): void;
export declare function createWebRtcTransport(channelId: string): Promise<{
    transport: mediasoup.types.WebRtcTransport<mediasoup.types.AppData>;
    params: {
        id: string;
        iceParameters: mediasoup.types.IceParameters;
        iceCandidates: mediasoup.types.IceCandidate[];
        dtlsParameters: mediasoup.types.DtlsParameters;
    };
}>;
export declare function createConsumer(channelId: string, transport: mediasoup.types.WebRtcTransport, producerId: string, rtpCapabilities: mediasoup.types.RtpCapabilities): Promise<{
    consumer: mediasoup.types.Consumer<mediasoup.types.AppData>;
    params: {
        id: string;
        producerId: string;
        kind: mediasoup.types.MediaKind;
        rtpParameters: mediasoup.types.RtpParameters;
    };
}>;
export declare function startAnnotationSession(channelId: string, sharerSocketId: string): void;
export declare function grantAnnotation(channelId: string, socketId: string): void;
export declare function revokeAnnotation(channelId: string, socketId: string): void;
export declare function canAnnotate(channelId: string, socketId: string): boolean;
export declare function endAnnotationSession(channelId: string): void;
export {};
//# sourceMappingURL=rooms.d.ts.map