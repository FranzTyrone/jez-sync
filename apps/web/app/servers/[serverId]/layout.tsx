"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

type Channel = {
  id: string;
  name: string;
  type: "TEXT" | "VOICE";
};

type ServerWithChannels = {
  id: string;
  name: string;
  channels: Channel[];
};

type VoiceParticipant = {
  socketId: string;
  userName: string;
  isMuted?: boolean;
  isDeafened?: boolean;
};

export default function ServerLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const serverId = params.serverId as string;
  const socket = getSocket();

  const [servers, setServers] = useState<ServerWithChannels[]>([]);
  const [voiceParticipants, setVoiceParticipants] = useState<Record<string, VoiceParticipant[]>>({});
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    function checkSize() {
      setIsMobile(window.innerWidth < 768);
    }
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;

    fetch(`http://localhost:3001/users/${session.user.id}/servers`)
      .then((res) => res.json())
      .then((data: ServerWithChannels[]) => setServers(data));
  }, [session?.user?.id]);

  const currentServer = servers.find((s) => s.id === serverId);

  function refreshVoiceParticipants(channelId: string) {
    socket.emit(
      "voice:getChannelParticipants",
      { channelId },
      (response: { participants: VoiceParticipant[] }) => {
        setVoiceParticipants((prev) => ({
          ...prev,
          [channelId]: response.participants,
        }));
      }
    );
  }

  useEffect(() => {
    if (!currentServer) return;

    socket.connect();

    const voiceChannels = currentServer.channels.filter((c) => c.type === "VOICE");
    voiceChannels.forEach((c) => refreshVoiceParticipants(c.id));

    function handleChange(data: { channelId: string }) {
      if (voiceChannels.some((c) => c.id === data.channelId)) {
        refreshVoiceParticipants(data.channelId);
      }
    }

    function handleMuteChanged(data: { socketId: string; isMuted: boolean }) {
      setVoiceParticipants((prev) => {
        const next: Record<string, VoiceParticipant[]> = {};
        for (const [channelId, list] of Object.entries(prev)) {
          next[channelId] = list.map((p) =>
            p.socketId === data.socketId ? { ...p, isMuted: data.isMuted } : p
          );
        }
        return next;
      });
    }

    function handleDeafenChanged(data: { socketId: string; isDeafened: boolean }) {
      setVoiceParticipants((prev) => {
        const next: Record<string, VoiceParticipant[]> = {};
        for (const [channelId, list] of Object.entries(prev)) {
          next[channelId] = list.map((p) =>
            p.socketId === data.socketId ? { ...p, isDeafened: data.isDeafened } : p
          );
        }
        return next;
      });
    }

    socket.on("voice:channelParticipantsChanged", handleChange);
    socket.on("voice:participantMuteChanged", handleMuteChanged);
    socket.on("voice:participantDeafenChanged", handleDeafenChanged);

    return () => {
      socket.off("voice:channelParticipantsChanged", handleChange);
      socket.off("voice:participantMuteChanged", handleMuteChanged);
      socket.off("voice:participantDeafenChanged", handleDeafenChanged);
    };
  }, [currentServer?.id]);

  const initials = (session?.user?.name || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function smallInitials(name: string) {
    return name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function navigateAndClose(path: string) {
    router.push(path);
    if (isMobile) setDrawerOpen(false);
  }

  const showSidebar = !isMobile || drawerOpen;

  return (
    <div style={{ display: "flex", fontFamily: "'Segoe UI', sans-serif", height: "100vh", overflow: "hidden", position: "relative" }}>
      {isMobile && (
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            position: "fixed",
            top: "12px",
            left: "12px",
            zIndex: 40,
            width: "38px",
            height: "38px",
            borderRadius: "8px",
            border: "none",
            background: "#0b1830",
            color: "#fff",
            fontSize: "18px",
            cursor: "pointer",
            display: showSidebar ? "none" : "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {"\u2630"}
        </button>
      )}

      {isMobile && drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 30,
          }}
        />
      )}

      <div
        style={{
          width: "72px",
          background: "#0b1830",
          display: showSidebar ? "flex" : "none",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: "16px",
          gap: "10px",
          position: isMobile ? "fixed" : "static",
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: isMobile ? 35 : "auto",
          height: "100vh",
        }}
      >
        {servers.map((s) => {
          const active = s.id === serverId;
          const sInitials = s.name.slice(0, 2).toUpperCase();
          return (
            <div
              key={s.id}
              onClick={() => navigateAndClose(`/servers/${s.id}/channels/${s.channels[0]?.id}`)}
              title={s.name}
              style={{
                width: "44px",
                height: "44px",
                borderRadius: active ? "14px" : "50%",
                background: active
                  ? "linear-gradient(135deg, #185FA5 0%, #1D9E75 100%)"
                  : "rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "border-radius 0.15s ease, background 0.15s ease",
                flexShrink: 0,
              }}
            >
              {sInitials}
            </div>
          );
        })}

        <div
          onClick={() => navigateAndClose("/create-server")}
          title="Create new server"
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            border: "1px dashed rgba(255,255,255,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#94a3b8",
            fontSize: "20px",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          +
        </div>
      </div>

      <div
        style={{
          width: isMobile ? "260px" : "240px",
          background: "#11213f",
          display: showSidebar ? "flex" : "none",
          flexDirection: "column",
          color: "#e2e8f0",
          height: "100vh",
          position: isMobile ? "fixed" : "static",
          top: 0,
          bottom: 0,
          left: isMobile ? "72px" : "auto",
          zIndex: isMobile ? 35 : "auto",
          boxShadow: isMobile ? "4px 0 16px rgba(0,0,0,0.3)" : "none",
        }}
      >
        <div
          style={{
            padding: "16px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            fontWeight: 600,
            fontSize: "15px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{currentServer?.name || "Loading..."}</span>
          {isMobile && (
            <button
              onClick={() => setDrawerOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                fontSize: "18px",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              {"\u2715"}
            </button>
          )}
        </div>

        <div style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
          <div
            onClick={() => navigateAndClose(`/servers/${serverId}/board`)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 8px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              color: "#cbd5e1",
              marginBottom: "4px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ color: "#64748b", fontSize: "15px" }}>⊞</span>
            Board
          </div>

          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              margin: "8px 8px 6px",
            }}
          >
            Channels
          </p>
          {currentServer?.channels.map((c) => {
            const participants = voiceParticipants[c.id] || [];
            return (
              <div key={c.id} style={{ marginBottom: "2px" }}>
                <div
                  onClick={() => navigateAndClose(`/servers/${serverId}/channels/${c.id}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 8px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    color: "#cbd5e1",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ color: "#64748b", fontSize: "15px" }}>
                    {c.type === "VOICE" ? "\u{1F50A}" : "#"}
                  </span>
                  {c.name}
                </div>

                {c.type === "VOICE" && participants.length > 0 && (
                  <div style={{ paddingLeft: "26px", paddingBottom: "4px" }}>
                    {participants.map((p) => (
                      <div
                        key={p.socketId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "3px 0",
                          fontSize: "12px",
                          color: "#94a3b8",
                        }}
                      >
                        <div
                          style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #185FA5 0%, #1D9E75 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            fontSize: "8px",
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {smallInitials(p.userName)}
                        </div>
                        {p.userName}
                        {p.isDeafened ? (
                          <span style={{ fontSize: "10px" }}>{"\u{1F515}"}</span>
                        ) : (
                          p.isMuted && <span style={{ fontSize: "10px" }}>{"\u{1F507}"}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          style={{
            padding: "10px 12px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #185FA5 0%, #1D9E75 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "12px",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: "13px",
                fontWeight: 500,
                margin: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {session?.user?.name}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: "13px",
              padding: "4px 6px",
            }}
          >
            Exit
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          background: "#0b1024",
          overflow: "auto",
          paddingTop: isMobile ? "56px" : 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div key={`${serverId}`} style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}