"use client";

import { getApiUrl } from '@/lib/config';
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams, useSearchParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import VoiceChannel from "@/components/voice/VoiceChannel";
import { useVoice } from "@/lib/VoiceContext";
import { useTheme, themeColors } from "@/lib/ThemeContext";

type Reaction = { emoji: string; count: number; userIds: string[] };
type Message = {
  id: string; content: string | null;
  authorId: string; author: { id: string; name: string; image?: string | null };
  createdAt: string; editedAt?: string; deletedAt?: string;
  reactions?: Reaction[];
};

const EMOJI_SET = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export default function ChannelPage() {
  const { data: session } = useSession();
  const params = useParams();
  const searchParams = useSearchParams();
  const channelId = params.channelId as string;
  const serverId  = params.serverId  as string;
  const autoJoin  = searchParams.get("autoJoin") === "true";
  const socket    = getSocket();
  const { voiceState } = useVoice();
  const { dark } = useTheme();
  const C = themeColors(dark);

  const [messages,        setMessages]        = useState<Message[]>([]);
  const [input,           setInput]           = useState("");
  const [connected,       setConnected]       = useState(false);
  const [inviteUrl,       setInviteUrl]       = useState("");
  const [channelType,     setChannelType]     = useState<"TEXT"|"VOICE"|null>(null);
  const [channelName,     setChannelName]     = useState("");
  const [serverOwnerId,   setServerOwnerId]   = useState<string|null>(null);
  const [editingId,       setEditingId]       = useState<string|null>(null);
  const [editingContent,  setEditingContent]  = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState<string|null>(null);
  const [inputFocused,    setInputFocused]    = useState(false);
  const [profilePopup,    setProfilePopup]    = useState<{ userId: string; name: string; image?: string | null; x: number; y: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!serverId || !session?.user?.id) return;
    fetch(`${getApiUrl()}/users/${session.user.id}/servers`, { credentials: "include" })
      .then((r) => r.json())
      .then((servers: any[]) => {
        const server  = servers.find((s) => s.id === serverId);
        const channel = server?.channels.find((c: any) => c.id === channelId);
        if (channel) { setChannelType(channel.type); setChannelName(channel.name); }
        if (server)  { setServerOwnerId(server.ownerId); }
      });
  }, [serverId, channelId, session?.user?.id]);

  useEffect(() => {
    if (!channelId || !session?.user?.id) return;
    socket.connect();
    socket.emit("user:auth", { userId: session.user.id });

    function handleConnect()    { setConnected(true);  socket.emit("channel:join", channelId); }
    function handleDisconnect() { setConnected(false); }
    function handleMessage(m: Message) { setMessages((p) => [...p, m]); }
    function handleUpdated(m: Message) {
      setMessages((p) => p.map((x) => x.id === m.id ? m : x));
      setEditingId(null); setEditingContent("");
    }
    function handleDeleted(d: { messageId: string; deletedAt: string }) {
      setMessages((p) => p.map((m) => m.id === d.messageId ? { ...m, deletedAt: d.deletedAt, content: null } : m));
    }
    function handleReactions(d: { messageId: string; reactions: Reaction[] }) {
      setMessages((p) => p.map((m) => m.id === d.messageId ? { ...m, reactions: d.reactions } : m));
    }

    socket.on("connect",           handleConnect);
    socket.on("disconnect",        handleDisconnect);
    socket.on("message:receive",   handleMessage);
    socket.on("message:updated",   handleUpdated);
    socket.on("message:deleted",   handleDeleted);
    socket.on("message:reactions", handleReactions);
    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect",           handleConnect);
      socket.off("disconnect",        handleDisconnect);
      socket.off("message:receive",   handleMessage);
      socket.off("message:updated",   handleUpdated);
      socket.off("message:deleted",   handleDeleted);
      socket.off("message:reactions", handleReactions);
    };
  }, [channelId, session?.user?.id]);

  useEffect(() => {
    if (!channelId || !session?.user?.id) return;
    const url = new URL(`${getApiUrl()}/channels/${channelId}/messages`);
    url.searchParams.set("userId", session.user.id);
    fetch(url.toString())
      .then(async (r) => {
        if (!r.ok) { setMessages([]); return; }
        const d = await r.json();
        setMessages(Array.isArray(d) ? d : []);
      })
      .catch(() => setMessages([]));
  }, [channelId, session?.user?.id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function sendMessage() {
    if (!input.trim() || !session?.user?.id) return;
    socket.emit("message:send", { channelId, content: input });
    setInput("");
  }

  function saveEdit(messageId: string) {
    if (!editingContent.trim()) return;
    socket.emit("message:edit", { messageId, content: editingContent });
  }

  function deleteMessage(messageId: string) {
    if (!window.confirm("Delete this message?")) return;
    socket.emit("message:delete", { messageId });
  }

  function toggleReaction(messageId: string, emoji: string) {
    socket.emit("message:react", { messageId, emoji });
  }

  async function generateInvite() {
    if (!session?.user?.id) return;
    const res = await fetch(`${getApiUrl()}/servers/${serverId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ createdBy: session.user.id }),
    });
    const d = await res.json();
    setInviteUrl(d.url);
  }

  if (!session) {
    return (
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: C.main }}>
        <p style={{ color: C.t3 }}>
          Please{" "}
          <a href="/login" style={{ color: C.teal, fontWeight: 600, textDecoration: "none" }}>log in</a>
          {" "}to continue.
        </p>
      </main>
    );
  }

  const groupedMessages: { date: string; messages: Message[] }[] = [];
  for (const msg of messages) {
    const dateLabel = formatDate(msg.createdAt);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === dateLabel) last.messages.push(msg);
    else groupedMessages.push({ date: dateLabel, messages: [msg] });
  }

  const msgHover = dark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.03)";
  const inputBg  = dark ? "rgba(255,255,255,0.05)"  : "rgba(0,0,0,0.04)";
  const inputBgF = dark ? "rgba(255,255,255,0.08)"  : "rgba(0,0,0,0.06)";

  function openProfile(e: React.MouseEvent, userId: string, name: string, image?: string | null) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setProfilePopup({ userId, name, image, x: rect.right + 10, y: rect.top });
  }

  function bannerGradient(name: string) {
    const hue = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
    return `linear-gradient(135deg, hsl(${hue},60%,${dark ? "20%" : "72%"}) 0%, hsl(${(hue + 60) % 360},55%,${dark ? "14%" : "60%"}) 100%)`;
  }

  return (
    <main
      style={{
        display: "flex", flexDirection: "column", height: "100%", minHeight: 0,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        background: C.main, transition: "background 0.2s ease",
      }}
      onClick={() => setShowEmojiPicker(null)}
    >
      {/* ── Profile popup backdrop + card ── */}
      {profilePopup && (() => {
        const cardW = 300;
        const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
        const vh = typeof window !== "undefined" ? window.innerHeight : 800;
        const x = profilePopup.x + cardW > vw ? profilePopup.x - cardW - 52 : profilePopup.x;
        const rawY = profilePopup.y;
        const y = rawY + 320 > vh ? vh - 332 : rawY;
        const grad = bannerGradient(profilePopup.name);
        const isMe = profilePopup.userId === session?.user?.id;
        return (
          <>
            {/* Invisible backdrop — clicking it closes the card */}
            <div
              style={{ position: "fixed", inset: 0, zIndex: 9998 }}
              onClick={() => setProfilePopup(null)}
            />
            {/* Profile card */}
            <div
              style={{
                position: "fixed", left: x, top: y, width: cardW, zIndex: 9999,
                borderRadius: "12px", overflow: "hidden",
                background: dark ? "#111d2e" : "#ffffff",
                border: `1px solid ${C.border}`,
                boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
                fontFamily: "'Segoe UI', system-ui, sans-serif",
              }}
            >
              {/* Banner */}
              <div style={{ height: "80px", background: grad, position: "relative" }}>
                <div style={{
                  position: "absolute", bottom: "-28px", left: "16px",
                  width: "60px", height: "60px", borderRadius: "50%",
                  border: `4px solid ${dark ? "#111d2e" : "#ffffff"}`,
                  overflow: "hidden", flexShrink: 0,
                }}>
                  {profilePopup.image ? (
                    <img src={profilePopup.image} alt={profilePopup.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{
                      width: "100%", height: "100%", background: grad,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "20px", fontWeight: 700, color: "#fff",
                    }}>{initials(profilePopup.name)}</div>
                  )}
                  <div style={{
                    position: "absolute", bottom: "3px", right: "3px",
                    width: "12px", height: "12px", borderRadius: "50%",
                    background: "#22c55e",
                    border: `2px solid ${dark ? "#111d2e" : "#ffffff"}`,
                  }} />
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: "36px 16px 16px" }}>
                <div style={{ marginBottom: "4px" }}>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: C.t1 }}>{profilePopup.name}</div>
                  {isMe && <div style={{ fontSize: "12px", color: C.t3, marginTop: "1px" }}>That&apos;s you!</div>}
                </div>

                <div style={{ height: "1px", background: C.border, margin: "12px 0" }} />

                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
                  <span style={{
                    fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px",
                    background: dark ? "rgba(66,219,188,0.12)" : "rgba(66,219,188,0.15)",
                    color: C.teal, border: `1px solid rgba(66,219,188,0.25)`,
                  }}>Member</span>
                  {serverOwnerId === profilePopup.userId && (
                    <span style={{
                      fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px",
                      background: dark ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.15)",
                      color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)",
                    }}>Owner</span>
                  )}
                </div>

                {!isMe && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "10px 12px", borderRadius: "8px",
                    background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                    border: `1px solid ${C.border}`,
                    color: C.t3, fontSize: "14px",
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    Message @{profilePopup.name}
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}
      {/* ── Channel header ── */}
      <div style={{
        padding: "0 20px", height: "52px", flexShrink: 0,
        background: C.card, borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: dark ? "none" : "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ color: C.teal, fontSize: "16px", fontWeight: 300, opacity: 0.8 }}>
            {channelType === "VOICE" ? "🔊" : "#"}
          </span>
          <span style={{ fontSize: "15px", fontWeight: 700, color: C.t1, letterSpacing: "-0.01em" }}>
            {channelName || "…"}
          </span>
          <span style={{
            fontSize: "10px", fontWeight: 700,
            padding: "3px 9px", borderRadius: "100px", letterSpacing: "0.05em",
            ...(channelType === "VOICE"
              ? voiceState?.channelId === channelId
                ? { color: "#10b981", background: "rgba(16,185,129,0.12)" }
                : { color: C.t3,     background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }
              : connected
                ? { color: "#10b981", background: "rgba(16,185,129,0.12)" }
                : { color: C.red,    background: "rgba(239,68,68,0.12)" }
            ),
          }}>
            {channelType === "VOICE"
              ? voiceState?.channelId === channelId ? "Connected" : "Not in voice"
              : connected ? "Live" : "Offline"
            }
          </span>
        </div>

        <button
          onClick={generateInvite}
          style={{
            padding: "6px 14px", borderRadius: "8px",
            border: `1px solid ${C.border}`,
            background: "rgba(66,219,188,0.07)",
            color: C.teal, fontSize: "12px", fontWeight: 600, cursor: "pointer",
            transition: "background 0.15s, border-color 0.15s", letterSpacing: "0.02em",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(66,219,188,0.15)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(66,219,188,0.4)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(66,219,188,0.07)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = C.border;
          }}
        >
          Invite people
        </button>
      </div>

      {/* Invite URL banner */}
      {inviteUrl && (
        <div style={{
          padding: "10px 20px", flexShrink: 0,
          background: "rgba(16,185,129,0.08)", borderBottom: "1px solid rgba(16,185,129,0.2)",
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <span style={{ fontSize: "12px", color: "#10b981", fontWeight: 700 }}>INVITE LINK</span>
          <span style={{ fontSize: "12px", color: C.t2, wordBreak: "break-all" }}>{inviteUrl}</span>
        </div>
      )}

      {/* Voice channel embed */}
      {channelType === "VOICE" && (
        <div style={{ background: C.main, flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          <VoiceChannel channelId={channelId} autoJoin={autoJoin} />
        </div>
      )}

      {/* ── Message list ── */}
      <div
        style={{
          flex: 1, overflowY: "auto", padding: "8px 0 4px",
          display: channelType === "VOICE" ? "none" : "block", minHeight: 0,
        }}
      >
        {!Array.isArray(messages) || messages.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px", paddingTop: "40px" }}>
            <div style={{
              width: "56px", height: "56px", borderRadius: "16px",
              background: "rgba(66,219,188,0.1)", border: "1px solid rgba(66,219,188,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px",
            }}>
              {Array.isArray(messages) ? "👋" : "⏳"}
            </div>
            <p style={{ color: C.t3, fontSize: "14px", margin: 0, textAlign: "center" }}>
              {Array.isArray(messages) ? `Start the conversation in #${channelName}` : "Loading messages…"}
            </p>
          </div>
        ) : (
          groupedMessages.map(({ date, messages: msgs }) => (
            <div key={date}>
              {/* Date divider */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px 8px" }}>
                <div style={{ flex: 1, height: "1px", backgroundColor: C.border }} />
                <span style={{ fontSize: "11px", fontWeight: 600, color: C.t3, whiteSpace: "nowrap" }}>{date}</span>
                <div style={{ flex: 1, height: "1px", backgroundColor: C.border }} />
              </div>

              {msgs.map((msg) => {
                const canEdit   = msg.authorId === session.user?.id && !msg.deletedAt;
                const canDelete = (msg.authorId === session.user?.id || serverOwnerId === session.user?.id) && !msg.deletedAt;
                const isEditing = editingId === msg.id;

                return (
                  <div
                    key={msg.id}
                    style={{ padding: "4px 20px", position: "relative" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.backgroundColor = msgHover;
                      const menu = e.currentTarget.querySelector("[data-menu]") as HTMLElement;
                      if (menu) menu.style.opacity = "1";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent";
                      const menu = e.currentTarget.querySelector("[data-menu]") as HTMLElement;
                      if (menu) menu.style.opacity = "0";
                    }}
                  >
                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      {/* Avatar */}
                      {msg.author.image ? (
                        <img
                          src={msg.author.image}
                          alt={msg.author.name}
                          onClick={(e) => openProfile(e, msg.authorId, msg.author.name, msg.author.image)}
                          style={{
                            width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
                            objectFit: "cover", marginTop: "1px", cursor: "pointer",
                            border: `1px solid ${C.border}`,
                          }}
                        />
                      ) : (
                        <div
                          onClick={(e) => openProfile(e, msg.authorId, msg.author.name)}
                          style={{
                            width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
                            background: C.grad,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "12px", fontWeight: 700, color: "#fff", marginTop: "1px",
                            cursor: "pointer",
                          }}
                        >
                          {initials(msg.author.name)}
                        </div>
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Name + time */}
                        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "3px" }}>
                          <span
                            onClick={(e) => openProfile(e, msg.authorId, msg.author.name, msg.author.image)}
                            style={{ fontSize: "14px", fontWeight: 700, color: C.t1, cursor: "pointer" }}
                            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                          >{msg.author.name}</span>
                          <span style={{ fontSize: "11px", color: C.t3 }}>{formatTime(msg.createdAt)}</span>
                          {msg.editedAt && <span style={{ fontSize: "11px", color: C.t3, fontStyle: "italic" }}>edited</span>}
                        </div>

                        {/* Content or edit form */}
                        {isEditing ? (
                          <div>
                            <input
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) saveEdit(msg.id);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              autoFocus
                              style={{
                                width: "100%", maxWidth: "600px", padding: "8px 12px",
                                fontSize: "14px", color: C.t1,
                                background: C.inputBg, border: `1px solid ${C.teal}`,
                                borderRadius: "8px", outline: "none", boxSizing: "border-box",
                                marginBottom: "6px", display: "block",
                                boxShadow: "0 0 0 3px rgba(66,219,188,0.1)",
                              }}
                            />
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button onClick={() => saveEdit(msg.id)} style={{
                                padding: "5px 12px", fontSize: "12px", fontWeight: 700, color: dark ? "#0d1524" : "#fff",
                                background: C.teal, border: "none", borderRadius: "6px", cursor: "pointer",
                              }}>Save</button>
                              <button onClick={() => setEditingId(null)} style={{
                                padding: "5px 12px", fontSize: "12px", color: C.t2,
                                background: "transparent", border: `1px solid ${C.border}`,
                                borderRadius: "6px", cursor: "pointer",
                              }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <p style={{
                            margin: 0, fontSize: "14px", lineHeight: 1.55,
                            color: msg.deletedAt ? C.t3 : C.t1,
                            fontStyle: msg.deletedAt ? "italic" : "normal",
                          }}>
                            {msg.deletedAt ? "(message deleted)" : msg.content}
                          </p>
                        )}

                        {/* Reactions */}
                        {!msg.deletedAt && (msg.reactions ?? []).length > 0 && (
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
                            {(msg.reactions ?? []).map((r) => {
                              const reacted = r.userIds?.includes(session.user?.id ?? "");
                              return (
                                <button
                                  key={r.emoji}
                                  onClick={() => toggleReaction(msg.id, r.emoji)}
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: "4px",
                                    padding: "3px 8px", borderRadius: "100px", fontSize: "12px",
                                    border: reacted ? "1px solid rgba(66,219,188,0.5)" : `1px solid ${C.border}`,
                                    background: reacted ? "rgba(66,219,188,0.12)" : C.hover,
                                    color: reacted ? C.teal : C.t2, cursor: "pointer",
                                    transition: "all 0.12s",
                                  }}
                                  onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(66,219,188,0.5)";
                                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(66,219,188,0.12)";
                                  }}
                                  onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = reacted ? "rgba(66,219,188,0.5)" : C.border;
                                    (e.currentTarget as HTMLButtonElement).style.background = reacted ? "rgba(66,219,188,0.12)" : C.hover;
                                  }}
                                >
                                  <span>{r.emoji}</span>
                                  <span style={{ fontWeight: 600 }}>{r.count}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div data-menu style={{
                        display: "flex", gap: "3px", opacity: 0, transition: "opacity 0.12s",
                        alignItems: "center", flexShrink: 0,
                      }}>
                        {canEdit && (
                          <ActionBtn title="Edit" dark={dark}
                            onClick={() => { setEditingId(msg.id); setEditingContent(msg.content || ""); }}>
                            ✏️
                          </ActionBtn>
                        )}
                        {canDelete && (
                          <ActionBtn title="Delete" dark={dark} onClick={() => deleteMessage(msg.id)}>
                            🗑️
                          </ActionBtn>
                        )}
                        {!msg.deletedAt && (
                          <div style={{ position: "relative" }}>
                            <ActionBtn title="React" dark={dark}
                              onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id); }}>
                              😊
                            </ActionBtn>
                            {showEmojiPicker === msg.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: "absolute", bottom: "calc(100% + 6px)", right: 0,
                                  background: C.card, border: `1px solid ${C.border}`,
                                  borderRadius: "10px", padding: "8px",
                                  display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "4px",
                                  zIndex: 20, boxShadow: dark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.12)",
                                }}
                              >
                                {EMOJI_SET.map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => { toggleReaction(msg.id, emoji); setShowEmojiPicker(null); }}
                                    style={{
                                      width: "30px", height: "30px", fontSize: "16px",
                                      border: "none", background: "transparent", cursor: "pointer",
                                      borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center",
                                      transition: "background 0.1s",
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = C.hover}
                                    onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Message input ── */}
      {channelType !== "VOICE" && (
        <div style={{
          padding: "12px 20px 14px", background: C.card,
          borderTop: `1px solid ${C.border}`, flexShrink: 0,
        }}>
          <div style={{
            display: "flex", alignItems: "center",
            background: inputFocused ? inputBgF : inputBg,
            border: inputFocused ? `1px solid rgba(66,219,188,0.6)` : `1px solid ${C.border}`,
            borderRadius: "12px", overflow: "hidden",
            transition: "border-color 0.2s, background 0.2s",
            boxShadow: inputFocused ? "0 0 0 3px rgba(66,219,188,0.1)" : "none",
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              onFocus={() => setInputFocused(true)}
              onBlur={()  => setInputFocused(false)}
              placeholder={`Message #${channelName}`}
              style={{
                flex: 1, padding: "12px 16px", background: "transparent",
                border: "none", color: C.t1, fontSize: "14px", outline: "none",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              style={{
                margin: "6px 8px", padding: "7px 16px", borderRadius: "8px", border: "none",
                background: input.trim() ? C.grad : C.hover,
                color: input.trim() ? "#fff" : C.t3,
                fontSize: "13px", fontWeight: 700, cursor: input.trim() ? "pointer" : "default",
                transition: "background 0.15s, color 0.15s",
                letterSpacing: "0.02em", flexShrink: 0,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      <style>{`
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.12)"}; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: ${dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.2)"}; }
        input::placeholder { color: ${C.t3}; }
      `}</style>
    </main>
  );
}

function ActionBtn({
  title, dark, onClick, children,
}: {
  title: string; dark: boolean; onClick: (e: React.MouseEvent) => void; children: React.ReactNode;
}) {
  const bg = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const bgH = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
  return (
    <button
      title={title} onClick={onClick}
      style={{
        width: "26px", height: "26px", borderRadius: "6px", border: "none",
        background: bg, fontSize: "12px",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = bgH}
      onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = bg}
    >
      {children}
    </button>
  );
}
