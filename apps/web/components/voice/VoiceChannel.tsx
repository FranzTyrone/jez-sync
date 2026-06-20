"use client";

import { useState, useRef, useEffect } from "react";
import * as mediasoupClient from "mediasoup-client";
import { getSocket, resetSocket } from "@/lib/socket";
import AnnotationCanvas from "./AnnotationCanvas";
import { useSession } from "next-auth/react";

type Props = {
  channelId: string;
};

type Participant = {
  socketId: string;
  userName: string;
  isMuted?: boolean;
};

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#0d1117",          // base canvas — true dark
  surface: "#161d2a",     // card/tile bg — clearly lifted from base
  surfaceHover: "#1c2638",
  border: "#252f42",      // solid border, always visible
  borderSubtle: "#1c2535",
  accent: "#6366f1",
  accentBg: "#1e1f4a",    // deep indigo fill
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
  pill: "#111827",        // control bar bg — opaque dark
};

const tileColors = [
  "#131d2e",  // deep navy
  "#0e1e1a",  // deep teal
  "#1a1030",  // deep violet
  "#1e1015",  // deep rose
  "#1a150d",  // deep amber
  "#0d1a28",  // deep slate-blue
];

// ─── Small reusable pieces ─────────────────────────────────────────────────────
function Avatar({ name, size = 52 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#1e2d45",
        border: `1.5px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: C.textPrimary,
        fontSize: size * 0.32,
        fontWeight: 600,
        letterSpacing: "0.02em",
        fontFamily: "system-ui, -apple-system, sans-serif",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function NameTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        position: "absolute",
        bottom: 10,
        left: 10,
        background: "rgba(13,17,23,0.8)",
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

  const bgMap = {
    default: active
      ? "#1e2d45"
      : hovered
      ? "#192333"
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
export default function VoiceChannel({ channelId }: Props) {
  const [connected, setConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isPushToTalk, setIsPushToTalk] = useState(false);
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const { data: session } = useSession();
  const myColor = "#6366f1";

  const socket = getSocket();

  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const recvTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const screenContainerRef = useRef<HTMLDivElement>(null);
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
      audioEl.autoplay = true;
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
      });
      if (joinResponse.error) return;

      const device = new mediasoupClient.Device();
      await device.load({ routerRtpCapabilities: joinResponse.rtpCapabilities });
      deviceRef.current = device;

      const sendTransportResponse = await emitWithAck("voice:createTransport", { channelId });
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

      const recvTransportResponse = await emitWithAck("voice:createTransport", { channelId });
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

      socket.on("annotation:requestReceived", (data: { requesterSocketId: string; requesterName: string }) => {
        setPendingRequests((prev) => [...prev, { socketId: data.requesterSocketId, name: data.requesterName }]);
      });

      socket.on("annotation:granted", () => setCanAnnotate(true));
      socket.on("annotation:denied", () => alert("Annotation request denied"));
      socket.on("annotation:revoked", () => setCanAnnotate(false));

      const producersResponse = await emitWithAck("voice:getProducers", { channelId });
      for (const p of producersResponse.producers) {
        await consumeProducer(p.producerId, p.socketId, p.appData?.mediaTag);
      }

      const participantsResponse = await emitWithAck("voice:getParticipants", { channelId });
      setParticipants(participantsResponse.participants);

      setConnected(true);
    } catch (err) {
      console.error("Failed to join voice:", err);
    }
  }

  function leaveVoice() {
    producerRef.current?.close();
    screenProducerRef.current?.close();
    camProducerRef.current?.close();
    consumersRef.current.forEach((c) => c.close());
    consumersRef.current.clear();
    localCamStream?.getTracks().forEach((t) => t.stop());
    if (audioContainerRef.current) audioContainerRef.current.innerHTML = "";
    resetSocket();
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
    camProducerRef.current = null;
  }

  function toggleMute() {
    const producer = producerRef.current;
    if (!producer) return;
    const muting = !isMuted;
    muting ? producer.pause() : producer.resume();
    setIsMuted(muting);
    socket.emit("voice:muteStateChanged", { channelId, isMuted: muting });
  }

  function toggleDeafen() {
    const deafening = !isDeafened;
    consumersRef.current.forEach((c) => (deafening ? c.pause() : c.resume()));
    if (deafening && !isMuted) toggleMute();
    setIsDeafened(deafening);
    socket.emit("voice:deafenStateChanged", { channelId, isDeafened: deafening });
  }

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
            kind: params.kind, rtpParameters: params.rtpParameters,
          });
          callback({ id: response.id });
        } catch (err) { errback(err as Error); }
      });

      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.onended = () => stopScreenShare();

      const producer = await screenTransport.produce({ track: videoTrack });
      screenProducerRef.current = producer;
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
    screenProducerRef.current = null;
    setScreenStream(null);
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
      producerRef.current?.close();
      screenProducerRef.current?.close();
      camProducerRef.current?.close();
      consumersRef.current.forEach((c) => c.close());
      consumersRef.current.clear();
      resetSocket();
    };
  }, []);

  useEffect(() => {
    if (!isPushToTalk || !connected) return;
    const producer = producerRef.current;
    if (!producer) return;
    producer.pause();
    setIsMuted(true);
    socket.emit("voice:muteStateChanged", { channelId, isMuted: true });

    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && producerRef.current) {
        producerRef.current.resume();
        setIsMuted(false);
        socket.emit("voice:muteStateChanged", { channelId, isMuted: false });
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space" && producerRef.current) {
        producerRef.current.pause();
        setIsMuted(true);
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

  // ─── Pre-join screen ─────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div
        style={{
          background: C.bg,
          borderRadius: 14,
          border: `1px solid ${C.border}`,
          minHeight: 280,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          marginBottom: "1rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
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
  const hasScreenContent = screenStream || isWatchingShare || canAnnotate;

  return (
    <div
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      style={{
        background: C.bg,
        borderRadius: 14,
        border: `1px solid ${C.border}`,
        padding: 14,
        paddingBottom: 88,
        marginBottom: "1rem",
        position: "relative",
        minHeight: 300,
      }}
    >
      {/* Participant tiles */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        {/* Self tile */}
        <div
          style={{
            background: tileColors[0],
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
            <Avatar name={session?.user?.name || "You"} />
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
                <Avatar name={p.userName} />
              )}
              <NameTag>
                {p.userName} {p.isMuted ? "🔇" : ""}
              </NameTag>
            </div>
          );
        })}

        {/* Screen share area */}
        {hasScreenContent && (
          <div
            ref={screenContainerRef}
            style={{
              flexBasis: "100%",
              background: "#000",
              borderRadius: isFullscreen ? 0 : 10,
              border: isFullscreen ? "none" : `1px solid ${C.border}`,
              position: "relative",
              width: "100%",
              height: isFullscreen ? "100vh" : "auto",
              aspectRatio: isFullscreen ? "auto" : "16/9",
              maxHeight: isFullscreen ? "none" : "70vh",
              overflow: "hidden",
            }}
          >
            {screenStream && (
              <video
                ref={(el) => {
                  if (el && el.srcObject !== screenStream) el.srcObject = screenStream;
                }}
                autoPlay
                playsInline
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
            <div style={{ position: "absolute", inset: 0 }}>
              <AnnotationCanvas
                channelId={channelId}
                canDraw={canAnnotate && !isSharer}
                myColor={myColor}
                myUserId={session?.user?.id || "unknown"}
                containerWidth={640}
                containerHeight={360}
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
          </div>
        )}
      </div>

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
    </div>
  );
}