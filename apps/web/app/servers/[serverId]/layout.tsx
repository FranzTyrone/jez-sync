"use client";

import { getApiUrl } from '@/lib/config';
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { useVoice } from "@/lib/VoiceContext";
import { SettingsModal } from "@/components/SettingsModal";
import { useTheme, themeColors } from "@/lib/ThemeContext";
import { useProfileImage } from "@/lib/ProfileImageContext";

// ─── Design tokens resolved per render from theme ────────────
// (C is set inside the component via useTheme)

type Channel = { id: string; name: string; type: "TEXT" | "VOICE" };
type ServerWithChannels = { id: string; name: string; channels: Channel[] };
type VoiceParticipant = { socketId: string; userName: string; userId?: string; userImage?: string | null; isMuted?: boolean; isDeafened?: boolean };

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

// ─── SVG icons ───────────────────────────────────────────────
const Icon = {
  hash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
      <line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
    </svg>
  ),
  volume: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  ),
  grid: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  ),
  mic: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  ),
  micOff: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
      <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  ),
  headphones: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
    </svg>
  ),
  screen: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  phone: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.98.38 2.03.6 3.12.6A2 2 0 0 1 22 17v3a2 2 0 0 1-2 2C10.07 22 2 13.93 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2c0 1.1.22 2.14.6 3.12a2 2 0 0 1-.45 2.11L8.68 10.68"/>
    </svg>
  ),
  logout: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  settings: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  plus: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  plusSm: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  trash: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  ),
  menu: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  x: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
};

function VoiceCtrlBtn({
  title, active, danger, onClick, children,
}: {
  title: string; active?: boolean; danger?: boolean; onClick?: () => void; children: React.ReactNode;
}) {
  const { dark } = useTheme();
  const C = themeColors(dark);
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        flex: 1, height: "30px", borderRadius: "7px", border: "none",
        background: danger
          ? active ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.12)"
          : active ? "rgba(66,219,188,0.2)" : dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
        color: danger ? C.red : active ? C.teal : C.t2,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = danger
          ? "rgba(239,68,68,0.3)" : active ? "rgba(66,219,188,0.3)" : dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = danger
          ? active ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.12)"
          : active ? "rgba(66,219,188,0.2)" : dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
      }}
    >
      {children}
    </button>
  );
}

export default function ServerLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const serverId = params.serverId as string;
  const { dark, toggle: toggleTheme } = useTheme();
  const C = themeColors(dark);

  const [servers, setServers] = useState<ServerWithChannels[]>([]);
  const [voiceParticipants, setVoiceParticipants] = useState<Record<string, VoiceParticipant[]>>({});
  const [musicActive, setMusicActive] = useState<Record<string, { active: boolean; title: string | null }>>({});
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addingChannel, setAddingChannel] = useState<"TEXT" | "VOICE" | null>(null);
  const [newChannelName, setNewChannelName] = useState("");
  const [channelError, setChannelError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [sidebarProfilePopup, setSidebarProfilePopup] = useState<{ name: string; x: number; y: number } | null>(null);
  const [showUserPopup, setShowUserPopup] = useState(false);
  const [userPopupAnchor, setUserPopupAnchor] = useState<{ x: number; y: number } | null>(null);
  const [userStatus, setUserStatus] = useState<"online" | "idle" | "dnd" | "invisible">("online");
  const [copiedId, setCopiedId] = useState(false);

  const socketRef = useRef(getSocket());
  const [socketVersion, setSocketVersion] = useState(0);
  const { voiceState, actionsRef, voicePrefs, setVoicePrefs } = useVoice();
  const { liveImage } = useProfileImage();

  useEffect(() => {
    const id = setInterval(() => {
      const fresh = getSocket();
      if (fresh !== socketRef.current) { socketRef.current = fresh; setSocketVersion((v) => v + 1); }
    }, 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  function refreshServers() {
    if (!session?.user?.id) return;
    fetch(`${getApiUrl()}/users/${session.user.id}/servers`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: ServerWithChannels[]) => setServers(data));
  }

  useEffect(() => { refreshServers(); }, [session?.user?.id]);

  async function createChannel(type: "TEXT" | "VOICE") {
    if (!newChannelName.trim()) return;
    setChannelError("");
    const res = await fetch(`${getApiUrl()}/servers/${serverId}/channels`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newChannelName.trim(), type }),
    });
    if (!res.ok) {
      const d = await res.json();
      setChannelError(d.error ?? "Failed to create channel");
      return;
    }
    const channel = await res.json();
    setNewChannelName(""); setAddingChannel(null); setChannelError("");
    refreshServers();
    nav(`/servers/${serverId}/channels/${channel.id}`);
  }

  async function deleteChannel(channelId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("Delete this channel and all its messages?")) return;
    const res = await fetch(`${getApiUrl()}/channels/${channelId}`, {
      method: "DELETE", credentials: "include",
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Failed to delete channel");
      return;
    }
    refreshServers();
    router.push(`/servers/${serverId}/boards`);
  }

  const currentServer = servers.find((s) => s.id === serverId);

  function refreshVoice(channelId: string) {
    socketRef.current.emit("voice:getChannelParticipants", { channelId }, (res: { participants: VoiceParticipant[] }) => {
      setVoiceParticipants((prev) => ({ ...prev, [channelId]: res.participants }));
    });
  }

  useEffect(() => {
    if (!currentServer) return;
    const socket = getSocket();
    socketRef.current = socket;
    socket.connect();
    const vc = currentServer.channels.filter((c) => c.type === "VOICE");
    vc.forEach((c) => refreshVoice(c.id));
    vc.forEach((c) => {
      socket.emit("music:getState", { channelId: c.id }, (state: any) => {
        const current = state?.queue?.[state.currentIndex];
        setMusicActive((prev) => ({ ...prev, [c.id]: { active: !!current && !state.paused, title: current?.title ?? null } }));
      });
    });

    function handleChange(_data: { channelId: string }) {
      vc.forEach((c) => refreshVoice(c.id));
    }
    function handleMusicActive(data: { channelId: string; active: boolean; title: string | null }) {
      setMusicActive((prev) => ({ ...prev, [data.channelId]: { active: data.active, title: data.title } }));
    }
    function handleMute(data: { socketId: string; isMuted: boolean }) {
      setVoiceParticipants((prev) => {
        const next: Record<string, VoiceParticipant[]> = {};
        for (const [k, list] of Object.entries(prev))
          next[k] = list.map((p) => p.socketId === data.socketId ? { ...p, isMuted: data.isMuted } : p);
        return next;
      });
    }
    function handleDeafen(data: { socketId: string; isDeafened: boolean }) {
      setVoiceParticipants((prev) => {
        const next: Record<string, VoiceParticipant[]> = {};
        for (const [k, list] of Object.entries(prev))
          next[k] = list.map((p) => p.socketId === data.socketId ? { ...p, isDeafened: data.isDeafened } : p);
        return next;
      });
    }
    socket.on("voice:channelParticipantsChanged", handleChange);
    socket.on("voice:participantMuteChanged", handleMute);
    socket.on("voice:participantDeafenChanged", handleDeafen);
    socket.on("music:activeChanged", handleMusicActive);
    return () => {
      socket.off("voice:channelParticipantsChanged", handleChange);
      socket.off("voice:participantMuteChanged", handleMute);
      socket.off("voice:participantDeafenChanged", handleDeafen);
      socket.off("music:activeChanged", handleMusicActive);
    };
  }, [currentServer?.id, socketVersion]);

  function nav(path: string) { router.push(path); if (isMobile) setDrawerOpen(false); }

  const showSidebar = !isMobile || drawerOpen;
  const isConnected = voiceState !== null;
  const { isMuted, isDeafened } = voicePrefs;
  const isSharing = voiceState?.isSharing ?? false;
  const voiceChannelId = voiceState?.channelId ?? voicePrefs.lastChannelId;
  const voiceChannelName = voiceChannelId
    ? currentServer?.channels.find((c) => c.id === voiceChannelId)?.name ?? "Voice"
    : null;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Segoe UI', system-ui, sans-serif", backgroundColor: C.main, transition: "background-color 0.2s ease, color 0.2s ease" }}>

      {/* Mobile menu button */}
      {isMobile && !showSidebar && (
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            position: "fixed", top: "12px", left: "12px", zIndex: 40,
            width: "36px", height: "36px", borderRadius: "8px", border: "none",
            backgroundColor: C.card, color: C.t2, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {Icon.menu}
        </button>
      )}

      {/* Mobile backdrop */}
      {isMobile && drawerOpen && (
        <div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 30 }} />
      )}

      {/* ── Server rail ── */}
      <div
        style={{
          width: "64px", flexShrink: 0,
          backgroundColor: C.rail,
          display: showSidebar ? "flex" : "none",
          flexDirection: "column", alignItems: "center",
          paddingTop: "12px", paddingBottom: "12px", gap: "6px",
          position: isMobile ? "fixed" : "static",
          top: 0, bottom: 0, left: 0, zIndex: isMobile ? 35 : "auto",
          height: "100vh",
          borderRight: `1px solid ${C.border}`,
          transition: "background-color 0.2s ease",
        }}
      >
        {servers.map((s) => {
          const active = s.id === serverId;
          return (
            <div key={s.id} style={{ position: "relative", display: "flex", alignItems: "center" }}>
              {active && (
                <div style={{
                  position: "absolute", left: "-12px", width: "4px", height: "32px",
                  backgroundColor: C.teal, borderRadius: "0 4px 4px 0",
                }} />
              )}
              <div
                onClick={() => nav(`/servers/${s.id}/channels/${s.channels[0]?.id}`)}
                title={s.name}
                style={{
                  width: "42px", height: "42px",
                  borderRadius: active ? "13px" : "50%",
                  background: active ? C.grad : dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: active ? "#fff" : C.t2, fontSize: "13px", fontWeight: 700,
                  cursor: "pointer",
                  transition: "border-radius 0.2s, background 0.2s, color 0.2s",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLDivElement).style.borderRadius = "13px";
                    (e.currentTarget as HTMLDivElement).style.background = dark ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.12)";
                    (e.currentTarget as HTMLDivElement).style.color = C.t1;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLDivElement).style.borderRadius = "50%";
                    (e.currentTarget as HTMLDivElement).style.background = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
                    (e.currentTarget as HTMLDivElement).style.color = C.t2;
                  }
                }}
              >
                {s.name.slice(0, 2).toUpperCase()}
              </div>
            </div>
          );
        })}

        <div style={{ width: "36px", height: "1px", backgroundColor: C.border, margin: "4px 0" }} />

        <div
          onClick={() => nav("/create-server")}
          title="Create server"
          style={{
            width: "42px", height: "42px", borderRadius: "50%",
            border: `1.5px dashed rgba(66,219,188,0.3)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: C.teal, cursor: "pointer", opacity: 0.7,
            transition: "opacity 0.2s, border-radius 0.2s, border-color 0.2s",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLDivElement;
            el.style.opacity = "1";
            el.style.borderRadius = "13px";
            el.style.borderColor = C.teal;
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLDivElement;
            el.style.opacity = "0.7";
            el.style.borderRadius = "50%";
            el.style.borderColor = "rgba(66,219,188,0.3)";
          }}
        >
          {Icon.plus}
        </div>
      </div>

      {/* ── Channel sidebar ── */}
      <div
        style={{
          width: isMobile ? "220px" : "232px", flexShrink: 0,
          backgroundColor: C.side,
          display: showSidebar ? "flex" : "none",
          flexDirection: "column",
          position: isMobile ? "fixed" : "static",
          top: 0, bottom: 0, left: isMobile ? "64px" : "auto",
          zIndex: isMobile ? 35 : "auto",
          height: "100vh",
          borderRight: `1px solid ${C.border}`,
          transition: "background-color 0.2s ease",
        }}
      >
        {/* Server name header */}
        <div style={{
          padding: "16px 14px 14px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: "15px", fontWeight: 700, color: C.t1, letterSpacing: "-0.01em" }}>
            {currentServer?.name ?? "Loading…"}
          </span>
          {isMobile && (
            <button onClick={() => setDrawerOpen(false)} style={{ background: "none", border: "none", color: C.t3, cursor: "pointer", display: "flex" }}>
              {Icon.x}
            </button>
          )}
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}>
          {/* Invite + Theme icon buttons row */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
            <button
              title="Invite People"
              onClick={async () => {
                if (!session?.user?.id) return;
                const res = await fetch(`${getApiUrl()}/servers/${serverId}/invites`, {
                  method: "POST", credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ createdBy: session.user.id }),
                });
                if (res.ok) {
                  const { code } = await res.json();
                  setInviteLink(`${window.location.origin}/invite/${code}`);
                }
              }}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                padding: "8px", borderRadius: "8px",
                background: "rgba(66,219,188,0.08)", border: "1px solid rgba(66,219,188,0.2)",
                color: C.teal, cursor: "pointer", transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(66,219,188,0.15)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(66,219,188,0.08)")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </button>

            <button
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggleTheme}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                padding: "8px", borderRadius: "8px",
                background: C.hover, border: `1px solid ${C.border}`,
                color: C.t2, cursor: "pointer", transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
                (e.currentTarget as HTMLButtonElement).style.color = C.t1;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = C.hover;
                (e.currentTarget as HTMLButtonElement).style.color = C.t2;
              }}
            >
              {dark ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
          </div>

          {/* Boards link */}
          <NavItem icon={Icon.grid} label="Boards" onClick={() => nav(`/servers/${serverId}/boards`)} dark={dark} C={C} />

          {/* Channels section */}
          <SectionLabel onAdd={() => { setAddingChannel("TEXT"); setNewChannelName(""); setChannelError(""); }} dark={dark} C={C}>
            Channels
          </SectionLabel>
          {currentServer?.channels.filter((c) => c.type === "TEXT").map((c) => (
            <NavItem
              key={c.id} icon={Icon.hash} label={c.name}
              onClick={() => nav(`/servers/${serverId}/channels/${c.id}`)}
              onDelete={(e) => deleteChannel(c.id, e)}
              dark={dark} C={C}
            />
          ))}
          {addingChannel === "TEXT" && (
            <ChannelForm
              type="TEXT"
              value={newChannelName}
              error={channelError}
              onChange={setNewChannelName}
              onSubmit={() => createChannel("TEXT")}
              onCancel={() => { setAddingChannel(null); setNewChannelName(""); setChannelError(""); }}
              dark={dark} C={C}
            />
          )}

          {/* Voice section */}
          <SectionLabel onAdd={() => { setAddingChannel("VOICE"); setNewChannelName(""); setChannelError(""); }} dark={dark} C={C}>
            Voice
          </SectionLabel>
          {currentServer?.channels.filter((c) => c.type === "VOICE").map((c) => {
            const participants = voiceParticipants[c.id] ?? [];
            const isActive = voiceState?.channelId === c.id;
            const botInfo = musicActive[c.id];
            const botShown = !!botInfo?.active;
            return (
              <div key={c.id}>
                <NavItem
                  icon={Icon.volume}
                  label={c.name}
                  active={isActive}
                  onClick={() => {
                    const alreadyOnPage = pathname.includes(`/channels/${c.id}`);
                    if (alreadyOnPage && !voiceState) {
                      // Component is already mounted; autoJoin won't re-fire — call directly
                      actionsRef.current?.joinVoice();
                    } else {
                      nav(`/servers/${serverId}/channels/${c.id}?autoJoin=true`);
                    }
                  }}
                  onDelete={(e) => deleteChannel(c.id, e)}
                  dark={dark} C={C}
                />
                {(participants.length > 0 || botShown) && (
                  <div style={{ paddingLeft: "28px", paddingBottom: "4px" }}>
                    {botShown && (
                      <div
                        title={botInfo?.title ?? undefined}
                        style={{ display: "flex", alignItems: "center", gap: "7px", padding: "3px 4px", borderRadius: "4px" }}
                      >
                        <div style={{
                          width: "18px", height: "18px", borderRadius: "50%",
                          background: "linear-gradient(135deg,#6366f1,#8b5cf6)", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "9px",
                        }}>🌙</div>
                        <span style={{ fontSize: "12px", color: C.t3, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          Music Bot
                        </span>
                        <span style={{ fontSize: "10px" }}>🎵</span>
                      </div>
                    )}
                    {participants.map((p) => (
                      <div
                        key={p.socketId}
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setSidebarProfilePopup({ name: p.userName, x: rect.right + 8, y: rect.top });
                        }}
                        style={{ display: "flex", alignItems: "center", gap: "7px", padding: "3px 4px", cursor: "pointer", borderRadius: "4px" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {(() => { const avatar = p.userId === session?.user?.id ? (liveImage ?? p.userImage) : p.userImage; return avatar ? (
                          <img src={avatar} alt={p.userName} style={{ width: "18px", height: "18px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                          <div style={{
                            width: "18px", height: "18px", borderRadius: "50%",
                            background: C.grad, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "8px", fontWeight: 700, color: "#fff",
                          }}>
                            {initials(p.userName)}
                          </div>
                        ); })()}
                        <span style={{ fontSize: "12px", color: C.t3, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.userName}
                        </span>
                        {(() => {
                          const isMe = p.userId === session?.user?.id;
                          const muted = isMe ? isMuted : p.isMuted;
                          const deafened = isMe ? isDeafened : p.isDeafened;
                          return deafened
                            ? <span style={{ fontSize: "10px" }}>🔕</span>
                            : muted
                            ? <span style={{ fontSize: "10px" }}>🔇</span>
                            : null;
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {addingChannel === "VOICE" && (
            <ChannelForm
              type="VOICE"
              value={newChannelName}
              error={channelError}
              onChange={setNewChannelName}
              onSubmit={() => createChannel("VOICE")}
              onCancel={() => { setAddingChannel(null); setNewChannelName(""); setChannelError(""); }}
              dark={dark} C={C}
            />
          )}
        </div>

        {/* Voice status + controls */}
        <div style={{
          borderTop: `1px solid ${C.border}`,
          backgroundColor: dark ? "#080f1e" : C.cardAlt,
          padding: "10px 10px 8px", flexShrink: 0,
          transition: "background-color 0.2s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "8px" }}>
            <div style={{
              width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0,
              backgroundColor: isConnected ? C.green : C.t3,
              boxShadow: isConnected ? `0 0 6px ${C.green}` : "none",
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "11px", fontWeight: 600, color: isConnected ? C.green : C.t3 }}>
                {isConnected ? "Voice Connected" : "Not connected"}
              </p>
              {voiceChannelName && (
                <p style={{ margin: 0, fontSize: "11px", color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {voiceChannelName}
                </p>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <VoiceCtrlBtn title={isMuted ? "Unmute" : "Mute"} active={isMuted}
              onClick={() => isConnected ? actionsRef.current?.toggleMute() : setVoicePrefs((p) => ({ ...p, isMuted: !p.isMuted }))}>
              {isMuted ? Icon.micOff : Icon.mic}
            </VoiceCtrlBtn>
            <VoiceCtrlBtn title={isDeafened ? "Undeafen" : "Deafen"} active={isDeafened}
              onClick={() => isConnected ? actionsRef.current?.toggleDeafen() : setVoicePrefs((p) => ({ ...p, isDeafened: !p.isDeafened }))}>
              {Icon.headphones}
            </VoiceCtrlBtn>
            {isConnected && (
              <>
                <VoiceCtrlBtn title={isSharing ? "Stop sharing" : "Share screen"} active={isSharing}
                  onClick={() => actionsRef.current?.toggleShare()}>
                  {Icon.screen}
                </VoiceCtrlBtn>
                <VoiceCtrlBtn title="Leave call" danger active
                  onClick={() => actionsRef.current?.leaveVoice()}>
                  {Icon.phone}
                </VoiceCtrlBtn>
              </>
            )}
          </div>
        </div>

        {/* User profile */}
        <div style={{
          padding: "10px 12px", borderTop: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", gap: "9px", flexShrink: 0,
          backgroundColor: dark ? "#080f1e" : C.cardAlt,
          transition: "background-color 0.2s ease",
        }}>
          {/* Clickable avatar + name area */}
          <div
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setUserPopupAnchor({ x: rect.right + 10, y: rect.top });
              setShowUserPopup(true);
            }}
            style={{ display: "flex", alignItems: "center", gap: "9px", flex: 1, minWidth: 0, cursor: "pointer", borderRadius: "8px", padding: "2px 4px", margin: "-2px -4px" }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = C.hover}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
          >
            <div style={{ position: "relative", flexShrink: 0 }}>
              {(liveImage ?? (session?.user as any)?.image) ? (
                <img
                  src={liveImage ?? (session?.user as any).image}
                  alt={session?.user?.name ?? ""}
                  style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.border}` }}
                />
              ) : (
                <div style={{
                  width: "40px", height: "40px", borderRadius: "50%",
                  background: C.grad,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "13px", fontWeight: 700, color: "#fff",
                }}>
                  {initials(session?.user?.name ?? "?")}
                </div>
              )}
              {/* Status dot */}
              <div style={{
                position: "absolute", bottom: 1, right: 1,
                width: "12px", height: "12px", borderRadius: "50%",
                border: `2px solid ${dark ? "#080f1e" : C.cardAlt}`,
                background: userStatus === "online" ? "#22c55e" : userStatus === "idle" ? "#f59e0b" : userStatus === "dnd" ? "#ef4444" : "#6b7280",
              }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {session?.user?.name}
              </p>
              <p style={{ margin: 0, fontSize: "11px", color: C.t3 }}>
                {userStatus === "online" ? "Online" : userStatus === "idle" ? "Idle" : userStatus === "dnd" ? "Do Not Disturb" : "Invisible"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            title="Settings"
            style={{ background: "none", border: "none", color: C.t3, cursor: "pointer", display: "flex", alignItems: "center", padding: "4px" }}
            onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.color = C.teal}
            onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.color = C.t3}
          >
            {Icon.settings}
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            style={{ background: "none", border: "none", color: C.t3, cursor: "pointer", display: "flex", alignItems: "center", padding: "4px" }}
            onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.color = C.red}
            onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.color = C.t3}
          >
            {Icon.logout}
          </button>

          {showSettings && <SettingsModal onClose={() => setShowSettings(false)} serverId={serverId} />}

          {/* Invite modal */}
          {inviteLink && (
            <div
              style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
              onClick={() => { setInviteLink(null); setInviteCopied(false); }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ width: "min(460px,100%)", background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: "16px", padding: "28px", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: C.t1 }}>Invite People</h3>
                  <button onClick={() => { setInviteLink(null); setInviteCopied(false); }} style={{ background: "none", border: "none", color: C.t3, cursor: "pointer", fontSize: "18px" }}>✕</button>
                </div>
                <p style={{ margin: "0 0 14px", fontSize: "13px", color: C.t2 }}>Share this link — anyone with it can join <strong style={{ color: C.t1 }}>{currentServer?.name}</strong>.</p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    readOnly
                    value={inviteLink}
                    style={{ flex: 1, padding: "10px 12px", background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: "8px", color: C.t2, fontSize: "13px", outline: "none", fontFamily: "monospace" }}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={() => { navigator.clipboard.writeText(inviteLink); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 2500); }}
                    style={{ padding: "10px 16px", borderRadius: "8px", border: "none", background: inviteCopied ? C.green : C.grad, color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", transition: "background 0.2s" }}
                  >
                    {inviteCopied ? "✓ Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", minWidth: 0,
        backgroundColor: C.main, overflow: "auto",
        paddingTop: isMobile ? "52px" : 0,
        transition: "background-color 0.2s ease",
      }}>
        <div key={serverId} style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {children}
        </div>
      </div>

      {/* ── Self user popup ── */}
      {showUserPopup && userPopupAnchor && (() => {
        const cardW = 300;
        const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
        const vh = typeof window !== "undefined" ? window.innerHeight : 800;
        const x = Math.min(userPopupAnchor.x, vw - cardW - 12);
        const y = Math.min(userPopupAnchor.y, vh - 420);
        const avatarSrc = liveImage ?? (session?.user as any)?.image ?? null;
        const userName = session?.user?.name ?? "User";
        const userId = (session?.user as any)?.id ?? "";
        const statusOptions: { key: "online" | "idle" | "dnd" | "invisible"; label: string; color: string; desc?: string }[] = [
          { key: "online",    label: "Online",         color: "#22c55e" },
          { key: "idle",      label: "Idle",           color: "#f59e0b" },
          { key: "dnd",       label: "Do Not Disturb", color: "#ef4444", desc: "You will not receive desktop notifications" },
          { key: "invisible", label: "Invisible",      color: "#6b7280", desc: "You will appear offline" },
        ];
        return (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={() => setShowUserPopup(false)} />
            <div style={{
              position: "fixed", left: x, top: y, width: cardW, zIndex: 9999,
              borderRadius: "14px", overflow: "hidden",
              background: dark ? "#0c1628" : "#ffffff",
              border: `1px solid ${C.border}`,
              boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
              fontFamily: "'Segoe UI', system-ui, sans-serif",
            }}>
              {/* Banner */}
              <div style={{ height: "72px", background: C.grad, position: "relative" }}>
                <div style={{
                  position: "absolute", bottom: "-26px", left: "16px",
                  width: "56px", height: "56px", borderRadius: "50%",
                  border: `4px solid ${dark ? "#0c1628" : "#ffffff"}`,
                  overflow: "hidden", background: C.grad,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {avatarSrc
                    ? <img src={avatarSrc} alt={userName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>{initials(userName)}</span>
                  }
                  {/* Status dot on avatar */}
                  <div style={{
                    position: "absolute", bottom: "2px", right: "2px",
                    width: "14px", height: "14px", borderRadius: "50%",
                    border: `2px solid ${dark ? "#0c1628" : "#ffffff"}`,
                    background: statusOptions.find(s => s.key === userStatus)?.color ?? "#22c55e",
                  }} />
                </div>
              </div>

              {/* Name */}
              <div style={{ padding: "34px 16px 4px" }}>
                <div style={{ fontSize: "18px", fontWeight: 800, color: C.t1 }}>{userName}</div>
              </div>

              <div style={{ height: "1px", background: C.border, margin: "10px 16px" }} />

              {/* Status options */}
              <div style={{ padding: "0 8px 6px" }}>
                {statusOptions.map((s) => (
                  <div
                    key={s.key}
                    onClick={() => setUserStatus(s.key)}
                    style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "9px 10px", borderRadius: "8px", cursor: "pointer",
                      background: userStatus === s.key ? (dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)") : "transparent",
                    }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = userStatus === s.key ? (dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)") : "transparent"}
                  >
                    <div style={{ width: "13px", height: "13px", borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: C.t1 }}>{s.label}</div>
                      {s.desc && <div style={{ fontSize: "11px", color: C.t3 }}>{s.desc}</div>}
                    </div>
                    {userStatus === s.key && <div style={{ marginLeft: "auto", width: "8px", height: "8px", borderRadius: "50%", background: C.teal }} />}
                  </div>
                ))}
              </div>

              <div style={{ height: "1px", background: C.border, margin: "4px 16px" }} />

              {/* Actions */}
              <div style={{ padding: "6px 8px 10px" }}>
                {[
                  { label: "Edit Profile", icon: "✏️", action: () => { setShowUserPopup(false); setShowSettings(true); } },
                  { label: "Copy User ID", icon: "🪪", action: () => { navigator.clipboard.writeText(userId); setCopiedId(true); setTimeout(() => setCopiedId(false), 2000); } },
                ].map((item) => (
                  <div
                    key={item.label}
                    onClick={item.action}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "9px 10px", borderRadius: "8px", cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  >
                    <span style={{ fontSize: "15px" }}>{item.label === "Copy User ID" && copiedId ? "✅" : item.icon}</span>
                    <span style={{ fontSize: "13px", fontWeight: 500, color: C.t1 }}>
                      {item.label === "Copy User ID" && copiedId ? "Copied!" : item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      })()}

      {/* Sidebar profile popup */}
      {sidebarProfilePopup && (() => {
        const cardW = 280;
        const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
        const vh = typeof window !== "undefined" ? window.innerHeight : 800;
        const x = sidebarProfilePopup.x + cardW > vw ? sidebarProfilePopup.x - cardW - 240 : sidebarProfilePopup.x;
        const y = Math.min(sidebarProfilePopup.y, vh - 260);
        const hue = sidebarProfilePopup.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
        const grad = `linear-gradient(135deg, hsl(${hue},60%,${dark ? "20%" : "72%"}) 0%, hsl(${(hue + 60) % 360},55%,${dark ? "14%" : "60%"}) 100%)`;
        return (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={() => setSidebarProfilePopup(null)} />
            <div style={{
              position: "fixed", left: x, top: y, width: cardW, zIndex: 9999,
              borderRadius: "12px", overflow: "hidden",
              background: dark ? "#111d2e" : "#ffffff",
              border: `1px solid ${C.border}`,
              boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
              fontFamily: "'Segoe UI', system-ui, sans-serif",
            }}>
              <div style={{ height: "70px", background: grad, position: "relative" }}>
                <div style={{
                  position: "absolute", bottom: "-24px", left: "14px",
                  width: "52px", height: "52px", borderRadius: "50%",
                  background: grad, border: `4px solid ${dark ? "#111d2e" : "#ffffff"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "16px", fontWeight: 700, color: "#fff",
                }}>
                  {sidebarProfilePopup.name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()}
                  <div style={{
                    position: "absolute", bottom: "2px", right: "2px",
                    width: "12px", height: "12px", borderRadius: "50%",
                    background: "#22c55e", border: `2px solid ${dark ? "#111d2e" : "#ffffff"}`,
                  }} />
                </div>
              </div>
              <div style={{ padding: "30px 14px 14px" }}>
                <div style={{ fontSize: "17px", fontWeight: 800, color: C.t1, marginBottom: "4px" }}>{sidebarProfilePopup.name}</div>
                <div style={{ height: "1px", background: C.border, margin: "10px 0" }} />
                <div style={{ display: "flex", gap: "6px" }}>
                  <span style={{
                    fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px",
                    background: dark ? "rgba(66,219,188,0.12)" : "rgba(66,219,188,0.15)",
                    color: C.teal, border: `1px solid rgba(66,219,188,0.25)`,
                  }}>Member</span>
                  <span style={{
                    fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px",
                    background: dark ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.12)",
                    color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)",
                  }}>In Voice</span>
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

// ── Small shared components ───────────────────────────────────
type ThemeProps = { dark: boolean; C: ReturnType<typeof themeColors> };

function SectionLabel({ children, onAdd, dark, C }: { children: React.ReactNode; onAdd?: () => void } & ThemeProps) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      margin: "14px 8px 4px",
    }}>
      <p style={{
        fontSize: "10px", fontWeight: 700, color: C.t2,
        textTransform: "uppercase", letterSpacing: "0.08em",
        margin: 0, userSelect: "none",
      }}>
        {children}
      </p>
      {onAdd && (
        <button
          onClick={onAdd}
          title="Add channel"
          style={{
            background: "none", border: "none", color: C.t3,
            cursor: "pointer", display: "flex", alignItems: "center",
            padding: "2px", borderRadius: "4px", transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.teal)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.t3)}
        >
          {Icon.plusSm}
        </button>
      )}
    </div>
  );
}

function NavItem({ icon, label, onClick, active, onDelete, dark, C }: {
  icon: React.ReactNode; label: string; onClick: () => void;
  active?: boolean; onDelete?: (e: React.MouseEvent) => void;
} & ThemeProps) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "7px 8px", borderRadius: "7px", cursor: "pointer",
        fontSize: "13px", fontWeight: active ? 600 : 400,
        color: active ? C.t1 : C.t2,
        backgroundColor: active ? "rgba(66,219,188,0.1)" : "transparent",
        transition: "background 0.15s, color 0.15s",
        userSelect: "none", position: "relative",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        if (!active) {
          el.style.backgroundColor = C.hover;
          el.style.color = C.t1;
        }
        const del = el.querySelector("[data-del]") as HTMLElement;
        if (del) del.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        if (!active) {
          el.style.backgroundColor = "transparent";
          el.style.color = C.t2;
        }
        const del = el.querySelector("[data-del]") as HTMLElement;
        if (del) del.style.opacity = "0";
      }}
    >
      <span style={{ color: active ? C.teal : "currentColor", display: "flex", flexShrink: 0 }}>{icon}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{label}</span>
      {onDelete && (
        <span
          data-del
          onClick={onDelete}
          title="Delete channel"
          style={{
            opacity: 0, transition: "opacity 0.12s",
            display: "flex", alignItems: "center", color: C.red,
            padding: "2px", borderRadius: "3px", flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.stopPropagation();
            (e.currentTarget as HTMLSpanElement).style.backgroundColor = "rgba(239,68,68,0.15)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLSpanElement).style.backgroundColor = "transparent";
          }}
        >
          {Icon.trash}
        </span>
      )}
    </div>
  );
}

function ChannelForm({ type, value, error, onChange, onSubmit, onCancel, dark, C }: {
  type: "TEXT" | "VOICE"; value: string; error: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
} & ThemeProps) {
  return (
    <div style={{ padding: "4px 8px 8px", animation: "fadeIn 0.15s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
        <span style={{ color: C.teal, display: "flex", flexShrink: 0, opacity: 0.7, fontSize: "11px" }}>
          {type === "VOICE" ? "🔊" : "#"}
        </span>
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder={type === "VOICE" ? "voice-channel" : "channel-name"}
          style={{
            flex: 1, padding: "5px 8px", fontSize: "12px", color: C.t1,
            background: C.inputBg,
            border: `1px solid rgba(66,219,188,0.5)`,
            borderRadius: "6px", outline: "none",
            boxShadow: "0 0 0 2px rgba(66,219,188,0.1)",
          }}
        />
      </div>
      {error && (
        <p style={{ margin: "0 0 4px 16px", fontSize: "11px", color: C.red }}>{error}</p>
      )}
      <div style={{ display: "flex", gap: "4px", paddingLeft: "16px" }}>
        <button
          onClick={onSubmit}
          style={{
            padding: "4px 10px", fontSize: "11px", fontWeight: 700, color: "#fff",
            background: C.grad,
            border: "none", borderRadius: "5px", cursor: "pointer",
          }}
        >
          Create
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "4px 8px", fontSize: "11px", color: C.t2,
            background: "none", border: `1px solid ${C.border}`,
            borderRadius: "5px", cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}
