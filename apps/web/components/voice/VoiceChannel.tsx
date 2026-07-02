"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import * as mediasoupClient from "mediasoup-client";
import { getSocket } from "@/lib/socket";
import { getApiUrl } from "@/lib/config";
import AnnotationCanvas from "./AnnotationCanvas";
import { useSession } from "next-auth/react";
import { useVoice } from "@/lib/VoiceContext";
import { useTheme } from "@/lib/ThemeContext";
import { useProfileImage } from "@/lib/ProfileImageContext";

type Props = {
  channelId: string;
  autoJoin?: boolean;
};

type MusicItem = {
  id: string;
  videoId: string;
  title: string;
  thumbnail: string;
  addedBy: string;
  duration?: string | null;
};


type Participant = {
  socketId: string;
  userName: string;
  userImage?: string | null;
  isMuted?: boolean;
  isDeafened?: boolean;
};

// ─── Design tokens ────────────────────────────────────────────────────────────
function voiceColors(dark: boolean) {
  return dark ? {
    bg: "#0d1117",
    surface: "#161d2a",
    surfaceHover: "#1c2638",
    border: "#252f42",
    borderSubtle: "#1c2535",
    accent: "#6366f1",
    accentBg: "#1e1f4a",
    accentBorder: "#3730a3",
    danger: "#ef4444",
    dangerBg: "#2d1515",
    dangerBorder: "#7f1d1d",
    success: "#10b981",
    successBg: "#0d2b20",
    successBorder: "#064e3b",
    amber: "#f59e0b",
    amberBg: "#2a1f08",
    amberBorder: "#78350f",
    textPrimary: "#e2e8f0",
    textMuted: "#4b5a72",
    textDim: "#8897ae",
    pill: "#111827",
    avatarBg: "#1e2d45",
    tileColors: ["#131d2e","#0e1e1a","#1a1030","#1e1015","#1a150d","#0d1a28"],
  } : {
    bg: "#f4f6fa",
    surface: "#ffffff",
    surfaceHover: "#f1f5f9",
    border: "rgba(0,0,0,0.1)",
    borderSubtle: "rgba(0,0,0,0.06)",
    accent: "#6366f1",
    accentBg: "#ede9fe",
    accentBorder: "#a5b4fc",
    danger: "#ef4444",
    dangerBg: "#fef2f2",
    dangerBorder: "#fca5a5",
    success: "#10b981",
    successBg: "#ecfdf5",
    successBorder: "#6ee7b7",
    amber: "#f59e0b",
    amberBg: "#fffbeb",
    amberBorder: "#fde68a",
    textPrimary: "#0f172a",
    textMuted: "#94a3b8",
    textDim: "#64748b",
    pill: "#ffffff",
    avatarBg: "#dbeafe",
    tileColors: ["#e8edf5","#e8f5f0","#ede8f5","#f5e8ec","#f5f0e8","#e8eef5"],
  };
}

// ─── Small reusable pieces ─────────────────────────────────────────────────────
function Avatar({ name, image, size = 52 }: { name: string; image?: string | null; size?: number }) {
  const { dark } = useTheme();
  const C = voiceColors(dark);
  const inits = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        style={{
          width: size, height: size, borderRadius: "50%", objectFit: "cover",
          border: `1.5px solid ${C.border}`, flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: C.avatarBg, border: `1.5px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: C.textPrimary, fontSize: size * 0.32, fontWeight: 600,
        letterSpacing: "0.02em", fontFamily: "system-ui, -apple-system, sans-serif",
        flexShrink: 0,
      }}
    >
      {inits}
    </div>
  );
}

function NameTag({ children }: { children: React.ReactNode }) {
  const { dark } = useTheme();
  const C = voiceColors(dark);
  return (
    <span
      style={{
        position: "absolute",
        bottom: 10,
        left: 10,
        background: dark ? "rgba(13,17,23,0.8)" : "rgba(255,255,255,0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        color: C.textPrimary,
        fontSize: 12,
        fontWeight: 500,
        padding: "4px 10px",
        borderRadius: 6,
        fontFamily: "system-ui, -apple-system, sans-serif",
        letterSpacing: "0.01em",
        border: `1px solid ${C.border}`,
      }}
    >
      {children}
    </span>
  );
}

function IconBtn({
  onClick,
  title,
  active,
  variant = "default",
  label,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  variant?: "default" | "danger" | "success" | "accent";
  label?: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const { dark } = useTheme();
  const C = voiceColors(dark);

  const bgMap = {
    default: active
      ? C.avatarBg
      : hovered
      ? C.surfaceHover
      : C.surface,
    danger: hovered ? C.danger : active ? C.danger : C.surface,
    success: active ? C.success : hovered ? C.successBg : C.surface,
    accent: active ? C.accent : hovered ? C.accentBg : C.surface,
  };

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <button
        onClick={onClick}
        title={title}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          border: `1px solid ${active ? C.border : C.borderSubtle}`,
          background: bgMap[variant],
          color: variant === "danger" && (active || hovered) ? "#fff" : C.textPrimary,
          fontSize: 16,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.15s ease, transform 0.1s ease",
          transform: hovered ? "translateY(-1px)" : "none",
          outline: "none",
        }}
      >
        {children}
      </button>
      {label && (
        <span
          style={{
            fontSize: 9,
            color: C.textMuted,
            fontWeight: 500,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function VoiceChannel({ channelId, autoJoin }: Props) {
  const { actionsRef, setVoiceState, voicePrefs, setVoicePrefs } = useVoice();
  const { dark } = useTheme();
  const C = voiceColors(dark);
  const tileColors = C.tileColors;

  const [connected, setConnected] = useState(false);
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const { isMuted, isDeafened } = voicePrefs;
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const [isSharer, setIsSharer] = useState(false);
  const [isWatchingShare, setIsWatchingShare] = useState(false);
  const [canAnnotate, setCanAnnotate] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<{ socketId: string; name: string }[]>([]);
  const [isCamOn, setIsCamOn] = useState(false);
  const [localCamStream, setLocalCamStream] = useState<MediaStream | null>(null);
  const [camStreams, setCamStreams] = useState<Map<string, MediaStream>>(new Map());
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [showChat, setShowChat] = useState(false);
  type ChatMessage = {
    id: string;
    content: string;
    author: { id: string; name: string; image?: string | null };
    queueAdd?: {
      title: string;
      thumbnail: string;
      duration: string | null;
      position: number;
      addedBy: string;
      replyAuthor: string;
      replyContent: string;
      timestamp: number;
    };
  };
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [musicQueue, setMusicQueue] = useState<MusicItem[]>([]);
  const [musicIndex, setMusicIndex] = useState(0);
  const [musicStartedAt, setMusicStartedAt] = useState<number | null>(null);
  const [musicPaused, setMusicPaused] = useState(false);
  const [musicPausedAt, setMusicPausedAt] = useState(0);
  const [musicLoading, setMusicLoading] = useState(false);
  const currentSong = musicQueue[musicIndex] ?? null;
  // Memoized so the iframe's `src` stays byte-identical across unrelated re-renders
  // (hover, tab focus, chat updates, etc.) — recomputing it from Date.now() on every
  // render would change `src` and make the browser reload the embed, restarting audio.
  const musicStartSeconds = useMemo(() => {
    if (musicStartedAt) return Math.max(0, Math.floor((Date.now() - musicStartedAt) / 1000));
    if (musicPausedAt) return Math.floor(musicPausedAt / 1000);
    return 0;
  }, [musicStartedAt, musicPausedAt]);
  const [videoRect, setVideoRect] = useState({ offsetX: 0, offsetY: 0, width: 640, height: 360 });
  const { data: session } = useSession();
  const { liveImage } = useProfileImage();
  const myImage = liveImage ?? (session?.user as any)?.image ?? null;
  const myColor = "#6366f1";

  const socket = getSocket();

  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const recvTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const screenContainerRef = useRef<HTMLDivElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const producerRef = useRef<mediasoupClient.types.Producer | null>(null);
  const screenProducerRef = useRef<mediasoupClient.types.Producer | null>(null);
  const camProducerRef = useRef<mediasoupClient.types.Producer | null>(null);
  const consumersRef = useRef<Map<string, mediasoupClient.types.Consumer>>(new Map());

  function emitWithAck(event: string, data: any): Promise<any> {
    return new Promise((resolve) => {
      socket.emit(event, data, resolve);
    });
  }

  function removeCamStream(socketId: string) {
    setCamStreams((prev) => {
      if (!prev.has(socketId)) return prev;
      const next = new Map(prev);
      next.delete(socketId);
      return next;
    });
  }

  async function consumeProducer(producerId: string, producerSocketId?: string, mediaTag?: string) {
    const device = deviceRef.current;
    const recvTransport = recvTransportRef.current;
    if (!device || !recvTransport) return;

    const response = await emitWithAck("voice:consume", {
      channelId,
      transportId: recvTransport.id,
      producerId,
      rtpCapabilities: device.rtpCapabilities,
    });

    if (response.error) return;

    const consumer = await recvTransport.consume(response.params);
    consumersRef.current.set(consumer.id, consumer);

    const stream = new MediaStream([consumer.track]);

    if (consumer.kind === "video") {
      if (mediaTag === "cam" && producerSocketId) {
        setCamStreams((prev) => {
          const next = new Map(prev);
          next.set(producerSocketId, stream);
          return next;
        });
      } else {
        setScreenStream(stream);
        setIsWatchingShare(true);
      }
    } else {
      const audioEl = document.createElement("audio");
      audioEl.srcObject = stream;
      audioEl.autoplay = !isDeafened;
      if (isDeafened) consumer.pause();
      audioContainerRef.current?.appendChild(audioEl);
    }
  }

  async function joinVoice() {
    try {
      socket.connect();

      const joinResponse = await emitWithAck("voice:join", {
        channelId,
        userName: session?.user?.name || "Someone",
        userId: session?.user?.id || "unknown",
        userImage: myImage,
      });
      if (joinResponse.error) return;

      const device = new mediasoupClient.Device();
      await device.load({ routerRtpCapabilities: joinResponse.rtpCapabilities });
      deviceRef.current = device;

      const sendTransportResponse = await emitWithAck("voice:createTransport", { channelId });
      if (sendTransportResponse.error) {
        console.error("Failed to create send transport:", sendTransportResponse.error);
        return;
      }
      const sendTransport = device.createSendTransport(sendTransportResponse.params);

      sendTransport.on("connect", async (params: any, callback: any, errback: any) => {
        try {
          await emitWithAck("voice:connectTransport", {
            transportId: sendTransport.id,
            dtlsParameters: params.dtlsParameters,
          });
          callback();
        } catch (err) { errback(err as Error); }
      });

      sendTransport.on("produce", async (params: any, callback: any, errback: any) => {
        try {
          const response = await emitWithAck("voice:produce", {
            channelId,
            transportId: sendTransport.id,
            kind: params.kind,
            rtpParameters: params.rtpParameters,
          });
          callback({ id: response.id });
        } catch (err) { errback(err as Error); }
      });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTrack = stream.getAudioTracks()[0];
      const producer = await sendTransport.produce({ track: audioTrack });
      producerRef.current = producer;

      // Apply pre-join mute/deafen preferences immediately.
      // isDeafened implies muted, so either pref pauses the mic producer.
      if (isMuted || isDeafened) {
        producer.pause();
        socket.emit("voice:muteStateChanged", { channelId, isMuted: true });
        // Ensure isMuted pref is consistent if we're joining deafened-but-not-muted.
        if (isDeafened && !isMuted) {
          setVoicePrefs((p) => ({ ...p, isMuted: true }));
        }
      }

      const recvTransportResponse = await emitWithAck("voice:createTransport", { channelId });
      if (recvTransportResponse.error) {
        console.error("Failed to create recv transport:", recvTransportResponse.error);
        return;
      }
      const recvTransport = device.createRecvTransport(recvTransportResponse.params);
      recvTransportRef.current = recvTransport;

      recvTransport.on("connect", async (params: any, callback: any, errback: any) => {
        try {
          await emitWithAck("voice:connectTransport", {
            transportId: recvTransport.id,
            dtlsParameters: params.dtlsParameters,
          });
          callback();
        } catch (err) { errback(err as Error); }
      });

      socket.on("voice:newProducer", (data: { producerId: string; socketId?: string; appData?: { mediaTag?: string } }) => {
        consumeProducer(data.producerId, data.socketId, data.appData?.mediaTag);
      });

      socket.on("voice:participantJoined", (data: Participant) => {
        setParticipants((prev) => {
          if (prev.some((p) => p.socketId === data.socketId)) return prev;
          return [...prev, data];
        });
      });

      socket.on("voice:participantLeft", (data: { socketId: string }) => {
        setParticipants((prev) => prev.filter((p) => p.socketId !== data.socketId));
        removeCamStream(data.socketId);
      });

      socket.on("voice:producerClosed", (data: { socketId: string; mediaTag?: string }) => {
        if (data.mediaTag === "cam") {
          removeCamStream(data.socketId);
        } else {
          setScreenStream(null);
          setIsWatchingShare(false);
        }
      });

      socket.on("voice:participantMuteChanged", (data: { socketId: string; isMuted: boolean }) => {
        setParticipants((prev) =>
          prev.map((p) => (p.socketId === data.socketId ? { ...p, isMuted: data.isMuted } : p))
        );
      });

      socket.on("voice:participantDeafenChanged", (data: { socketId: string; isDeafened: boolean }) => {
        setParticipants((prev) =>
          prev.map((p) => (p.socketId === data.socketId ? { ...p, isDeafened: data.isDeafened } : p))
        );
      });

      socket.on("annotation:requestReceived", (data: { requesterSocketId: string; requesterName: string }) => {
        setPendingRequests((prev) => [...prev, { socketId: data.requesterSocketId, name: data.requesterName }]);
      });

      socket.on("annotation:granted", () => setCanAnnotate(true));
      socket.on("annotation:denied", () => alert("Annotation request denied"));
      socket.on("annotation:clearAll", () => setCanAnnotate(false));

      const producersResponse = await emitWithAck("voice:getProducers", { channelId });
      if (!producersResponse.error) {
        for (const p of producersResponse.producers) {
          await consumeProducer(p.producerId, p.socketId, p.appData?.mediaTag);
        }
      }

      const participantsResponse = await emitWithAck("voice:getParticipants", { channelId });
      if (!participantsResponse.error) {
        setParticipants(participantsResponse.participants);
      }

      setConnected(true);
    } catch (err) {
      console.error("Failed to join voice:", err);
    }
  }

  useEffect(() => {
    if (autoJoin && session?.user?.id && !connected) {
      joinVoice();
    }
  }, [autoJoin, session?.user?.id]);

  function leaveVoice() {
    // Emit voice:leave BEFORE any cleanup so the server removes us from the room
    // and broadcasts participantsChanged while the socket is still listening.
    // Do NOT call resetSocket() here — removing listeners kills the event delivery.
    socket.emit("voice:leave");
    producerRef.current?.close();
    screenProducerRef.current?.close();
    camProducerRef.current?.close();
    consumersRef.current.forEach((c) => c.close());
    consumersRef.current.clear();
    localCamStream?.getTracks().forEach((t) => t.stop());
    localScreenStream?.getTracks().forEach((t) => t.stop());
    if (audioContainerRef.current) audioContainerRef.current.innerHTML = "";
    setVoiceState(null);
    actionsRef.current = null;
    setConnected(false);
    setIsSharing(false);
    setIsSharer(false);
    setIsWatchingShare(false);
    setCanAnnotate(false);
    setParticipants([]);
    setIsCamOn(false);
    setLocalCamStream(null);
    setCamStreams(new Map());
    setScreenStream(null);
    setLocalScreenStream(null);
    camProducerRef.current = null;
  }

  function toggleMute() {
    const producer = producerRef.current;
    if (!producer) return;
    const muting = !isMuted;
    muting ? producer.pause() : producer.resume();
    if (!muting && isDeafened) {
      // Unmuting while deafened: exit deafen too, mirroring Discord's behavior.
      consumersRef.current.forEach((c) => c.resume());
      setVoicePrefs((p) => ({ ...p, isMuted: false, isDeafened: false }));
      socket.emit("voice:deafenStateChanged", { channelId, isDeafened: false });
    } else {
      setVoicePrefs((p) => ({ ...p, isMuted: muting }));
    }
    socket.emit("voice:muteStateChanged", { channelId, isMuted: muting });
  }

  function toggleDeafen() {
    const deafening = !isDeafened;
    consumersRef.current.forEach((c) => (deafening ? c.pause() : c.resume()));
    if (deafening) {
      // Directly pause the producer and force isMuted:true in a single atomic update.
      // Never delegate to toggleMute() here — it reads isMuted from the closure and
      // toggles it, which is wrong if voicePrefs.isMuted was set from outside
      // VoiceChannel (sidebar pre-join path, join-time fix) without the producer
      // actually being paused, breaking the guard and toggle-direction both.
      const producer = producerRef.current;
      if (producer) producer.pause();
      setVoicePrefs((p) => ({ ...p, isDeafened: true, isMuted: true }));
      socket.emit("voice:muteStateChanged", { channelId, isMuted: true });
    } else {
      setVoicePrefs((p) => ({ ...p, isDeafened: false }));
    }
    socket.emit("voice:deafenStateChanged", { channelId, isDeafened: deafening });
  }

  // Keep actions ref current on every render so the sidebar always calls the latest closure.
  actionsRef.current = {
    toggleMute,
    toggleDeafen,
    toggleShare: isSharing ? stopScreenShare : startScreenShare,
    leaveVoice,
    joinVoice,
  };

  // Sync connection/sharing state to context so the sidebar panel stays accurate.
  useEffect(() => {
    if (connected) {
      setVoiceState({ isSharing, channelId });
      setVoicePrefs((p) => ({ ...p, lastChannelId: channelId }));
    } else {
      setVoiceState(null);
    }
  }, [connected, isSharing, channelId]);

  async function toggleCam() {
    if (isCamOn) {
      const producer = camProducerRef.current;
      producer?.close();
      if (producer) socket.emit("voice:closeProducer", { channelId, producerId: producer.id });
      camProducerRef.current = null;
      localCamStream?.getTracks().forEach((t) => t.stop());
      setLocalCamStream(null);
      setIsCamOn(false);
      return;
    }
    try {
      const device = deviceRef.current;
      if (!device) return;
      const camTransportResponse = await emitWithAck("voice:createTransport", { channelId });
      const camTransport = device.createSendTransport(camTransportResponse.params);

      camTransport.on("connect", async (params: any, callback: any, errback: any) => {
        try {
          await emitWithAck("voice:connectTransport", { transportId: camTransport.id, dtlsParameters: params.dtlsParameters });
          callback();
        } catch (err) { errback(err as Error); }
      });

      camTransport.on("produce", async (params: any, callback: any, errback: any) => {
        try {
          const response = await emitWithAck("voice:produce", {
            channelId, transportId: camTransport.id,
            kind: params.kind, rtpParameters: params.rtpParameters, appData: params.appData,
          });
          callback({ id: response.id });
        } catch (err) { errback(err as Error); }
      });

      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 } });
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) return;
      videoTrack.onended = () => toggleCam();

      const producer = await camTransport.produce({ track: videoTrack, appData: { mediaTag: "cam" } });
      camProducerRef.current = producer;
      setLocalCamStream(stream);
      setIsCamOn(true);
    } catch (err) {
      console.error("Failed to start camera:", err);
    }
  }

  async function startScreenShare() {
    try {
      const device = deviceRef.current;
      if (!device) return;
      const sendTransportResponse = await emitWithAck("voice:createTransport", { channelId });
      const screenTransport = device.createSendTransport(sendTransportResponse.params);

      screenTransport.on("connect", async (params: any, callback: any, errback: any) => {
        try {
          await emitWithAck("voice:connectTransport", { transportId: screenTransport.id, dtlsParameters: params.dtlsParameters });
          callback();
        } catch (err) { errback(err as Error); }
      });

      screenTransport.on("produce", async (params: any, callback: any, errback: any) => {
        try {
          const response = await emitWithAck("voice:produce", {
            channelId, transportId: screenTransport.id,
            kind: params.kind, rtpParameters: params.rtpParameters, appData: params.appData,
          });
          callback({ id: response.id });
        } catch (err) { errback(err as Error); }
      });

      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) return;
      videoTrack.onended = () => stopScreenShare();

      const producer = await screenTransport.produce({ track: videoTrack, appData: { mediaTag: "screen" } });
      screenProducerRef.current = producer;
      setLocalScreenStream(stream);
      setIsSharing(true);
      setIsSharer(true);
      socket.emit("annotation:start", { channelId });
    } catch (err) {
      console.error("Failed to start screen share:", err);
    }
  }

  function stopScreenShare() {
    screenProducerRef.current?.close();
    if (screenProducerRef.current) {
      socket.emit("voice:closeProducer", { channelId, producerId: screenProducerRef.current.id });
    }
    localScreenStream?.getTracks().forEach((t) => t.stop());
    screenProducerRef.current = null;
    setScreenStream(null);
    setLocalScreenStream(null);
    setIsSharing(false);
    setIsSharer(false);
    setIsWatchingShare(false);
    setCanAnnotate(false);
    socket.emit("annotation:end", { channelId });
  }

  function requestAnnotation() {
    socket.emit("annotation:request", { channelId, requesterName: session?.user?.name || "Someone" });
  }

  function grantRequest(targetSocketId: string) {
    socket.emit("annotation:grant", { channelId, targetSocketId });
    setPendingRequests((prev) => prev.filter((r) => r.socketId !== targetSocketId));
  }

  function denyRequest(targetSocketId: string) {
    socket.emit("annotation:deny", { channelId, targetSocketId });
    setPendingRequests((prev) => prev.filter((r) => r.socketId !== targetSocketId));
  }

  function toggleFullscreen() {
    const el = screenContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  useEffect(() => {
    function handleDisconnect() {
      setConnected(false);
      setParticipants([]);
      setIsSharing(false);
      setIsSharer(false);
      setIsWatchingShare(false);
      setCanAnnotate(false);
      setScreenStream(null);
    }
    function handleKicked(data: { reason: string }) {
      alert(`Disconnected: ${data.reason}`);
    }
    socket.on("disconnect", handleDisconnect);
    socket.on("voice:kicked", handleKicked);
    return () => {
      socket.off("disconnect", handleDisconnect);
      socket.off("voice:kicked", handleKicked);
    };
  }, []);

  useEffect(() => {
    return () => {
      // Emit before any cleanup so server receives the event and updates all sidebars
      socket.emit("voice:leave");
      producerRef.current?.close();
      screenProducerRef.current?.close();
      camProducerRef.current?.close();
      consumersRef.current.forEach((c) => c.close());
      consumersRef.current.clear();
      setVoiceState(null);
      actionsRef.current = null;
    };
  }, []);

  // ─── Music room socket listener ───────────────────────────────
  useEffect(() => {
    if (!connected) return;
    socket.emit("music:getState", { channelId }, (state: any) => {
      setMusicQueue(state.queue ?? []);
      setMusicIndex(state.currentIndex ?? 0);
      setMusicStartedAt(state.startedAt ?? null);
      setMusicPaused(state.paused ?? false);
      setMusicPausedAt(state.pausedAt ?? 0);
    });
    function onMusicState(state: any) {
      setMusicQueue(state.queue ?? []);
      setMusicIndex(state.currentIndex ?? 0);
      setMusicStartedAt(state.startedAt ?? null);
      setMusicPaused(state.paused ?? false);
      setMusicPausedAt(state.pausedAt ?? 0);
    }
    function onMusicAnnounce(data: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `music-announce-${data.itemId}`,
          content: "",
          author: { id: "music-bot", name: "Music Bot", image: null },
          queueAdd: {
            title: data.title,
            thumbnail: data.thumbnail,
            duration: data.duration ?? null,
            position: data.position,
            addedBy: data.addedBy,
            replyAuthor: data.replyAuthor,
            replyContent: data.replyContent,
            timestamp: data.timestamp ?? Date.now(),
          },
        },
      ]);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
    socket.on("music:state", onMusicState);
    socket.on("music:announce", onMusicAnnounce);
    return () => { socket.off("music:state", onMusicState); socket.off("music:announce", onMusicAnnounce); };
  }, [connected, channelId]);

  // ─── Voice channel chat ────────────────────────────────────────
  useEffect(() => {
    if (!connected) return;
    // Load history
    fetch(`${getApiUrl()}/channels/${channelId}/messages?limit=50`, { credentials: "include" })
      .then((r) => r.json())
      .then((msgs) => { if (Array.isArray(msgs)) setChatMessages(msgs.reverse()); })
      .catch(() => {});
    socket.emit("channel:join", channelId);
    function onMessage(msg: any) {
      setChatMessages((prev) => [...prev, msg]);
      setUnreadCount((n) => showChat ? 0 : n + 1);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
    socket.on("message:receive", onMessage);
    return () => { socket.off("message:receive", onMessage); };
  }, [connected, channelId]);

  useEffect(() => {
    if (showChat) {
      setUnreadCount(0);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "instant" }), 50);
    }
  }, [showChat]);

  function botNotice(text: string) {
    setChatMessages((prev) => [
      ...prev,
      {
        id: `bot-${Date.now()}-${Math.random()}`,
        content: text,
        author: { id: "music-bot", name: "Music Bot", image: null },
      },
    ]);
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function sendChatMessage() {
    const content = chatInput.trim();
    if (!content || !session?.user?.id) return;

    // Music commands
    const playMatch = content.match(/^\/play(?:\s+(.+))?$/i);
    if (playMatch) {
      setChatInput("");
      const input = (playMatch[1] ?? "").trim();
      if (!input) { botNotice("Usage: /play <song name or YouTube link>"); return; }
      setMusicLoading(true);
      let videoId: string | null = null;
      let title = input;
      let thumbnail = "";
      let duration: string | null = null;
      try {
        const res = await fetch(`/api/youtube/resolve?q=${encodeURIComponent(input)}`);
        if (res.ok) {
          const data = await res.json();
          videoId = data.videoId;
          title = data.title;
          thumbnail = data.thumbnail ?? "";
          duration = data.duration ?? null;
        }
      } catch {}
      setMusicLoading(false);
      if (videoId) {
        socket.emit("music:add", {
          channelId, videoId, title, thumbnail, duration,
          addedBy: session.user.name ?? "Someone",
          replyAuthor: session.user.name ?? "Someone",
          replyContent: content,
        });
      } else {
        botNotice(`No results found for "${input}"`);
      }
      return;
    }
    if (/^\/(skip|next)$/i.test(content)) { setChatInput(""); socket.emit("music:skip", { channelId }); return; }
    if (/^\/pause$/i.test(content)) { setChatInput(""); socket.emit("music:pause", { channelId }); return; }
    if (/^\/resume$/i.test(content)) { setChatInput(""); socket.emit("music:resume", { channelId }); return; }
    if (/^\/stop$/i.test(content)) { setChatInput(""); socket.emit("music:skip", { channelId }); return; }

    setChatInput("");
    socket.emit("message:send", { channelId, authorId: session.user.id, content });
  }

  useEffect(() => {
    if (!isPushToTalk || !connected) return;
    const producer = producerRef.current;
    if (!producer) return;
    producer.pause();
    setVoicePrefs((p) => ({ ...p, isMuted: true }));
    socket.emit("voice:muteStateChanged", { channelId, isMuted: true });

    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && producerRef.current) {
        producerRef.current.resume();
        setVoicePrefs((p) => ({ ...p, isMuted: false }));
        socket.emit("voice:muteStateChanged", { channelId, isMuted: false });
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space" && producerRef.current) {
        producerRef.current.pause();
        setVoicePrefs((p) => ({ ...p, isMuted: true }));
        socket.emit("voice:muteStateChanged", { channelId, isMuted: true });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [isPushToTalk, connected]);

  useEffect(() => {
    const container = screenContainerRef.current;
    const video = screenVideoRef.current;
    if (!container) return;

    function update() {
      const cw = container!.clientWidth;
      const ch = container!.clientHeight;
      const vw = video?.videoWidth ?? 0;
      const vh = video?.videoHeight ?? 0;
      if (!vw || !vh) return;
      const scale = Math.min(cw / vw, ch / vh);
      const rw = vw * scale;
      const rh = vh * scale;
      setVideoRect({
        offsetX: (cw - rw) / 2,
        offsetY: (ch - rh) / 2,
        width: rw,
        height: rh,
      });
    }

    const ro = new ResizeObserver(update);
    ro.observe(container);
    if (video) video.addEventListener("loadedmetadata", update);
    update();

    return () => {
      ro.disconnect();
      if (video) video.removeEventListener("loadedmetadata", update);
    };
  }, [screenStream, localScreenStream, isWatchingShare, canAnnotate]);

  // ─── Pre-join screen ─────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div
        style={{
          background: C.bg,
          borderRadius: 0,
          border: "none",
          flex: 1,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ocean wave layers */}
        <svg
          style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "45%", pointerEvents: "none" }}
          viewBox="0 0 1200 300"
          preserveAspectRatio="none"
        >
          <path
            d="M0,150 C200,200 400,100 600,150 C800,200 1000,100 1200,150 L1200,300 L0,300 Z"
            fill="rgba(99,102,241,0.05)"
          >
            <animate
              attributeName="d"
              dur="8s"
              repeatCount="indefinite"
              values="
                M0,150 C200,200 400,100 600,150 C800,200 1000,100 1200,150 L1200,300 L0,300 Z;
                M0,160 C200,110 400,210 600,160 C800,110 1000,210 1200,160 L1200,300 L0,300 Z;
                M0,150 C200,200 400,100 600,150 C800,200 1000,100 1200,150 L1200,300 L0,300 Z
              "
            />
          </path>
          <path
            d="M0,180 C300,130 600,230 900,180 C1050,155 1150,200 1200,180 L1200,300 L0,300 Z"
            fill="rgba(99,102,241,0.08)"
          >
            <animate
              attributeName="d"
              dur="11s"
              repeatCount="indefinite"
              values="
                M0,180 C300,130 600,230 900,180 C1050,155 1150,200 1200,180 L1200,300 L0,300 Z;
                M0,190 C300,235 600,135 900,190 C1050,215 1150,165 1200,190 L1200,300 L0,300 Z;
                M0,180 C300,130 600,230 900,180 C1050,155 1150,200 1200,180 L1200,300 L0,300 Z
              "
            />
          </path>
          <path
            d="M0,210 C250,250 500,170 750,210 C950,240 1100,190 1200,210 L1200,300 L0,300 Z"
            fill="rgba(99,102,241,0.12)"
          >
            <animate
              attributeName="d"
              dur="6.5s"
              repeatCount="indefinite"
              values="
                M0,210 C250,250 500,170 750,210 C950,240 1100,190 1200,210 L1200,300 L0,300 Z;
                M0,220 C250,180 500,260 750,220 C950,195 1100,250 1200,220 L1200,300 L0,300 Z;
                M0,210 C250,250 500,170 750,210 C950,240 1100,190 1200,210 L1200,300 L0,300 Z
              "
            />
          </path>
        </svg>

        {/* Subtle ambient glow */}
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 260,
            height: 260,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: C.accentBg,
            border: `1px solid ${C.accentBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            marginBottom: 16,
          }}
        >
          🔊
        </div>

        <p
          style={{
            color: C.textPrimary,
            fontSize: 16,
            fontWeight: 600,
            margin: "0 0 6px",
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: "-0.01em",
          }}
        >
          Voice channel
        </p>
        <p
          style={{
            color: C.textMuted,
            fontSize: 13,
            margin: "0 0 24px",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          No one is currently in voice
        </p>

        <button
          onClick={joinVoice}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#5558e8";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = C.accent;
          }}
          style={{
            padding: "10px 24px",
            borderRadius: 9,
            border: "none",
            background: C.accent,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: "-0.01em",
            transition: "background 0.15s ease",
          }}
        >
          Join voice
        </button>
      </div>
    );
  }

  // ─── Connected view ───────────────────────────────────────────────────────────
  const hasScreenContent = screenStream || localScreenStream || isWatchingShare || canAnnotate;

  return (
    <div
      style={{ flex: 1, width: "100%", display: "flex", flexDirection: "row", background: C.bg, position: "relative", overflow: "hidden" }}
    >
      {/* Hidden audio-only YouTube player */}
      {currentSong && !musicPaused && (
        <iframe
          key={`${currentSong.videoId}-${musicStartedAt ?? musicPausedAt}`}
          src={`https://www.youtube.com/embed/${currentSong.videoId}?autoplay=1&start=${musicStartSeconds}&enablejsapi=1`}
          allow="autoplay; encrypted-media"
          style={{ position: "absolute", width: "1px", height: "1px", opacity: 0, pointerEvents: "none", top: 0, left: 0 }}
        />
      )}

    {/* ── Left: voice tiles + controls ── */}
    <div
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      style={{
        flex: 1, display: "flex", flexDirection: "column",
        padding: 14, paddingBottom: 88,
        position: "relative", minWidth: 0, overflow: "hidden",
      }}
    >

      {/* Top-right chat toggle */}
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 40, display: "flex", gap: 6 }}>
        <button
          onClick={() => setShowChat((v) => !v)}
          title={showChat ? "Close chat" : "Open chat"}
          style={{
            width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`,
            background: showChat ? C.accent : C.surface,
            color: showChat ? "#fff" : C.textDim,
            cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", transition: "background 0.15s",
          }}
        >
          💬
          {!showChat && unreadCount > 0 && (
            <span style={{
              position: "absolute", top: -4, right: -4, background: "#ef4444",
              color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: "50%",
              width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center",
            }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
          )}
        </button>
      </div>

      {/* Participant tiles — only shown when not screen sharing */}
      {!hasScreenContent && (() => {
        const botActive = !!currentSong;
        const totalTiles = 1 + participants.length + (botActive ? 1 : 0);
        const alone = totalTiles === 1;
        return (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            justifyContent: "center",
            alignItems: alone ? "center" : "flex-start",
            flex: alone ? 1 : undefined,
            height: alone ? "100%" : undefined,
          }}
        >
          {/* Self tile */}
          <div
            style={{
              background: tileColors[0],
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              aspectRatio: "16/9",
              flex: alone ? "0 0 min(72%, 860px)" : "1 1 340px",
              maxWidth: alone ? "860px" : 520,
              width: alone ? "min(72%, 860px)" : undefined,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {localCamStream ? (
              <video
                ref={(el) => {
                  if (el && el.srcObject !== localCamStream) el.srcObject = localCamStream;
                }}
                autoPlay
                playsInline
                muted
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scaleX(-1)",
                }}
              />
            ) : (
              <Avatar name={session?.user?.name || "You"} image={myImage} size={alone ? 110 : 52} />
            )}
            <NameTag>
              {session?.user?.name ?? "You"}{" "}
              {isDeafened ? "🔕" : isMuted ? "🔇" : ""}
              {isPushToTalk && (
                <span
                  style={{
                    marginLeft: 4,
                    fontSize: 10,
                    background: C.accentBg,
                    color: C.accent,
                    padding: "1px 5px",
                    borderRadius: 4,
                    fontWeight: 600,
                  }}
                >
                  PTT
                </span>
              )}
            </NameTag>
          </div>

          {/* Remote participant tiles */}
          {participants.map((p, i) => {
            const camStream = camStreams.get(p.socketId);
            return (
              <div
                key={p.socketId}
                style={{
                  background: tileColors[(i + 1) % tileColors.length],
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  aspectRatio: "16/9",
                  flex: "1 1 340px",
                  maxWidth: 520,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {camStream ? (
                  <video
                    ref={(el) => {
                      if (el && el.srcObject !== camStream) el.srcObject = camStream;
                    }}
                    autoPlay
                    playsInline
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Avatar name={p.userName} image={p.userImage} />
                )}
                <NameTag>
                  {p.userName} {p.isDeafened ? "🔕" : p.isMuted ? "🔇" : ""}
                </NameTag>
              </div>
            );
          })}

          {/* Music Bot tile */}
          {botActive && currentSong && (
            <div
              style={{
                background: "linear-gradient(135deg,#312e81,#1e1b4b)",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                aspectRatio: "16/9",
                flex: "1 1 340px",
                maxWidth: 520,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22,
                animation: musicPaused ? "none" : "musicBotPulse 1.6s ease-in-out infinite",
              }}>🌙</div>
              <div style={{
                position: "absolute", top: 10, right: 10,
                display: "flex", alignItems: "center", gap: 4,
                background: "rgba(0,0,0,0.4)", borderRadius: 6, padding: "3px 7px",
              }}>
                <span style={{ fontSize: 11 }}>{musicPaused ? "⏸" : "🎵"}</span>
                <span style={{ fontSize: 10, color: "#c7d2fe", fontWeight: 600, maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentSong.title}</span>
              </div>
              <NameTag>Music Bot 🌙</NameTag>
              <style>{`@keyframes musicBotPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.5); } 50% { box-shadow: 0 0 0 8px rgba(139,92,246,0); } }`}</style>
            </div>
          )}
        </div>
        );
      })()}

      {/* Screen share area — fills available height; participant tiles float inside */}
      {hasScreenContent && (
        <div
          ref={screenContainerRef}
          style={{
            background: "#000",
            borderRadius: isFullscreen ? 0 : 10,
            border: isFullscreen ? "none" : `1px solid ${C.border}`,
            position: "relative",
            width: "100%",
            flex: 1,
            minHeight: 0,
            height: isFullscreen ? "100vh" : undefined,
            overflow: "hidden",
          }}
        >
          {(screenStream || localScreenStream) && (
            <video
              ref={(el) => {
                screenVideoRef.current = el;
                const src = screenStream || localScreenStream;
                if (el && el.srcObject !== src) el.srcObject = src;
              }}
              autoPlay
              playsInline
              muted={isSharer}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />
          )}
          <div style={{
            position: "absolute",
            left: videoRect.offsetX,
            top: videoRect.offsetY,
            width: videoRect.width,
            height: videoRect.height,
          }}>
            <AnnotationCanvas
              channelId={channelId}
              canDraw={canAnnotate && !isSharer}
              myColor={myColor}
              myUserId={session?.user?.id || "unknown"}
              containerWidth={Math.round(videoRect.width)}
              containerHeight={Math.round(videoRect.height)}
            />
          </div>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              width: 34,
              height: 34,
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: "#0d1117cc",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              color: C.textPrimary,
              fontSize: 14,
              cursor: "pointer",
              zIndex: 5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isFullscreen ? "✕" : "⛶"}
          </button>

          {/* Participant tiles — floating overlay, bottom-right corner */}
          <div
            style={{
              position: "absolute",
              bottom: 12,
              right: 12,
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {/* Self tile */}
            <div
              style={{
                width: 160,
                height: 90,
                background: tileColors[0],
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                boxShadow: "0 4px 20px rgba(0,0,0,0.65)",
                position: "relative",
                overflow: "hidden",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {localCamStream ? (
                <video
                  ref={(el) => {
                    if (el && el.srcObject !== localCamStream) el.srcObject = localCamStream;
                  }}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scaleX(-1)",
                  }}
                />
              ) : (
                <Avatar name={session?.user?.name || "You"} image={myImage} size={28} />
              )}
              <NameTag>
                {session?.user?.name ?? "You"}{" "}
                {isDeafened ? "🔕" : isMuted ? "🔇" : ""}
              </NameTag>
            </div>

            {/* Remote participant tiles */}
            {participants.map((p, i) => {
              const camStream = camStreams.get(p.socketId);
              return (
                <div
                  key={p.socketId}
                  style={{
                    width: 160,
                    height: 90,
                    background: tileColors[(i + 1) % tileColors.length],
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.65)",
                    position: "relative",
                    overflow: "hidden",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {camStream ? (
                    <video
                      ref={(el) => {
                        if (el && el.srcObject !== camStream) el.srcObject = camStream;
                      }}
                      autoPlay
                      playsInline
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <Avatar name={p.userName} image={p.userImage} size={28} />
                  )}
                  <NameTag>
                    {p.userName} {p.isMuted ? "🔇" : ""}
                  </NameTag>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Request to annotate */}
      {isWatchingShare && !isSharer && (
        <button
          onClick={requestAnnotation}
          style={{
            marginTop: 10,
            padding: "8px 14px",
            borderRadius: 8,
            border: `1px solid ${C.accentBorder}`,
            background: C.accentBg,
            color: C.accent,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "system-ui, -apple-system, sans-serif",
            transition: "background 0.15s ease",
          }}
        >
          ✏️ Request to annotate
        </button>
      )}

      {/* Pending annotation requests */}
      {isSharer &&
        pendingRequests.map((req) => (
          <div
            key={req.socketId}
            style={{
              marginTop: 10,
              padding: "10px 14px",
              background: C.amberBg,
              border: `1px solid ${C.amberBorder}`,
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            <span style={{ flex: 1, fontSize: 13, color: "#fde68a" }}>
              <strong style={{ fontWeight: 600 }}>{req.name}</strong> wants to annotate
            </span>
            <button
              onClick={() => grantRequest(req.socketId)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "none",
                background: C.success,
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Allow
            </button>
            <button
              onClick={() => denyRequest(req.socketId)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                background: "transparent",
                color: C.textDim,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Deny
            </button>
          </div>
        ))}

      {/* ─── Floating control bar ──────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: "50%",
          transform: showControls
            ? "translateX(-50%) translateY(0) scale(1)"
            : "translateX(-50%) translateY(12px) scale(0.97)",
          opacity: showControls ? 1 : 0,
          display: "flex",
          alignItems: "flex-end",
          gap: 6,
          background: C.pill,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `1px solid ${C.border}`,
          padding: "10px 14px",
          borderRadius: 14,
          boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
          transition: "opacity 0.2s ease, transform 0.2s ease",
          zIndex: 50,
          pointerEvents: showControls ? "auto" : "none",
        }}
      >
        {/* Participant count pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "0 10px",
            height: 42,
            marginRight: 2,
          }}
        >
          <span style={{ fontSize: 13, color: C.textDim, fontFamily: "system-ui, -apple-system, sans-serif" }}>
            {participants.length + 1}
          </span>
          <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "system-ui, -apple-system, sans-serif" }}>
            in call
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 30, background: C.border, margin: "0 2px" }} />

        <IconBtn onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"} active={isMuted} variant="default" label={isMuted ? "Muted" : "Mic"}>
          {isMuted ? "🔇" : "🎤"}
        </IconBtn>

        <IconBtn onClick={toggleDeafen} title={isDeafened ? "Undeafen" : "Deafen"} active={isDeafened} variant="default" label={isDeafened ? "Deafened" : "Audio"}>
          {isDeafened ? "🔕" : "🔊"}
        </IconBtn>

        <IconBtn
          onClick={() => setIsPushToTalk(!isPushToTalk)}
          title="Push to talk (Space)"
          active={isPushToTalk}
          variant="accent"
          label="PTT"
        >
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "-0.02em" }}>PTT</span>
        </IconBtn>

        <IconBtn onClick={toggleCam} title={isCamOn ? "Turn off camera" : "Turn on camera"} active={isCamOn} variant="accent" label="Camera">
          📹
        </IconBtn>

        <IconBtn
          onClick={isSharing ? stopScreenShare : startScreenShare}
          title={isSharing ? "Stop sharing" : "Share screen"}
          active={isSharing}
          variant="accent"
          label="Screen"
        >
          🖥
        </IconBtn>

        {/* Divider */}
        <div style={{ width: 1, height: 30, background: C.border, margin: "0 2px" }} />

        <IconBtn onClick={leaveVoice} title="Leave call" variant="danger" label="Leave">
          📞
        </IconBtn>
      </div>

      <div ref={audioContainerRef} />
    </div>{/* end left voice area */}

      {/* ── Chat Panel ── */}
      {showChat && connected && (
        <div style={{
          width: "320px", minWidth: "320px", background: C.surface,
          borderLeft: `1px solid ${C.border}`,
          display: "flex", flexDirection: "column",
          fontFamily: "system-ui, -apple-system, sans-serif",
          height: "100%",
        }}>
          {/* Header */}
          <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <span style={{ fontWeight: 700, fontSize: "15px", color: C.textPrimary }}>💬 Chat</span>
            <button onClick={() => setShowChat(false)} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: "18px", lineHeight: 1 }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {chatMessages.length === 0 && (
              <div style={{ textAlign: "center", color: C.textDim, fontSize: "12px", marginTop: "24px" }}>No messages yet. Say hello!</div>
            )}
            {chatMessages.map((msg, i) => {
              if (msg.queueAdd) {
                const q = msg.queueAdd;
                const time = new Date(q.timestamp).toLocaleString(undefined, {
                  month: "2-digit", day: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
                });
                return (
                  <div key={msg.id} style={{ marginTop: "6px" }}>
                    {/* Reply reference line */}
                    <div style={{ display: "flex", alignItems: "center", gap: "5px", marginLeft: "38px", marginBottom: "2px", fontSize: "11px", color: C.textDim, overflow: "hidden" }}>
                      <span style={{ opacity: 0.6 }}>↩</span>
                      <span style={{ color: C.accent, fontWeight: 600 }}>@{q.replyAuthor}</span>
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.replyContent}</span>
                    </div>
                    <div style={{ display: "flex", gap: "9px", alignItems: "flex-start" }}>
                      <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", marginTop: "1px" }}>🌙</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: C.textPrimary }}>Music Bot</span>
                          <span style={{
                            fontSize: "10px", fontWeight: 700, color: "#fff", background: C.accent,
                            borderRadius: "3px", padding: "1px 5px", display: "inline-flex", alignItems: "center", gap: "2px",
                          }}>✓ APP</span>
                          <span style={{ fontSize: "11px", color: C.textDim }}>{time}</span>
                        </div>
                        <p style={{ margin: "2px 0 0", fontSize: "13px", color: C.textPrimary, lineHeight: 1.5, wordBreak: "break-word" }}>
                          🎵🎶 <strong>{q.title}</strong> added to the queue (<span style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: "4px", padding: "0 5px" }}>{q.duration ?? "—:—"}</span>) — at position <strong>{q.position}</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
              const prev = chatMessages[i - 1];
              const grouped = !prev?.queueAdd && prev?.author?.id === msg.author?.id;
              const initStr = (msg.author?.name ?? "?").split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase();
              return (
                <div key={msg.id} style={{ display: "flex", gap: "9px", alignItems: "flex-start", marginTop: grouped ? 0 : "4px" }}>
                  {!grouped ? (
                    msg.author?.image
                      ? <img src={msg.author.image} alt="" style={{ width: "30px", height: "30px", borderRadius: "50%", objectFit: "cover", flexShrink: 0, marginTop: "1px" }} />
                      : <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: C.accentBg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: C.accent, marginTop: "1px" }}>{initStr}</div>
                  ) : (
                    <div style={{ width: "30px", flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {!grouped && (
                      <span style={{ fontSize: "12px", fontWeight: 700, color: C.textPrimary }}>{msg.author?.name ?? "Unknown"}</span>
                    )}
                    <p style={{ margin: 0, fontSize: "13px", color: C.textPrimary, lineHeight: 1.5, wordBreak: "break-word" }}>{msg.content}</p>
                  </div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                placeholder="Message… or /play <song name or URL>"
                style={{
                  flex: 1, padding: "9px 12px", borderRadius: "8px",
                  background: C.bg, border: `1px solid ${C.border}`,
                  color: C.textPrimary, fontSize: "13px", outline: "none",
                }}
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatInput.trim()}
                style={{
                  width: "36px", height: "36px", borderRadius: "8px", border: "none",
                  background: chatInput.trim() ? C.accent : C.accentBg,
                  color: chatInput.trim() ? "#fff" : C.textDim,
                  cursor: chatInput.trim() ? "pointer" : "default",
                  fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  transition: "background 0.15s",
                }}
              >➤</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}