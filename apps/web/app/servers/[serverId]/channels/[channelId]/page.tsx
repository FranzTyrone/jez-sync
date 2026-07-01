"use client";

import { getApiUrl } from '@/lib/config';
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import VoiceChannel from "@/components/voice/VoiceChannel";
import { useVoice } from "@/lib/VoiceContext";

type Reaction = { emoji: string; count: number; userIds: string[] };
type Message = {
  id: string; content: string | null;
  authorId: string; author: { id: string; name: string };
  createdAt: string; editedAt?: string; deletedAt?: string;
  reactions?: Reaction[];
};

const EMOJI_SET = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

const C = {
  bg:     "#0d1524",
  card:   "#111d2e",
  border: "rgba(255,255,255,0.07)",
  t1:     "#f1f5f9",
  t2:     "#94a3b8",
  t3:     "#475569",
  teal:   "#42DBBC",
  blue:   "#21579A",
  grad:   "linear-gradient(135deg, #42DBBC 0%, #21579A 100%)",
  red:    "#ef4444",
};

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
  const channelId = params.channelId as string;
  const serverId  = params.serverId  as string;
  const socket    = getSocket();
  const { voiceState } = useVoice();

  const [messages,       setMessages]       = useState<Message[]>([]);
  const [input,          setInput]          = useState("");
  const [connected,      setConnected]      = useState(false);
  const [inviteUrl,      setInviteUrl]      = useState("");
  const [channelType,    setChannelType]    = useState<"TEXT"|"VOICE"|null>(null);
  const [channelName,    setChannelName]    = useState("");
  const [serverOwnerId,  setServerOwnerId]  = useState<string|null>(null);
  const [editingId,      setEditingId]      = useState<string|null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [showEmojiPicker,setShowEmojiPicker]= useState<string|null>(null);
  const [inputFocused,   setInputFocused]   = useState(false);
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

    socket.on("connect",                handleConnect);
    socket.on("disconnect",             handleDisconnect);
    socket.on("message:receive",        handleMessage);
    socket.on("message:updated",        handleUpdated);
    socket.on("message:deleted",        handleDeleted);
    socket.on("message:reactions",      handleReactions);
    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect",             handleConnect);
      socket.off("disconnect",          handleDisconnect);
      socket.off("message:receive",     handleMessage);
      socket.off("message:updated",     handleUpdated);
      socket.off("message:deleted",     handleDeleted);
      socket.off("message:reactions",   handleReactions);
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
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: C.bg }}>
        <p style={{ color: C.t3 }}>
          Please{" "}
          <a href="/login" style={{ color: C.teal, fontWeight: 600, textDecoration: "none" }}>log in</a>
          {" "}to continue.
        </p>
      </main>
    );
  }

  // Group messages by date for dividers
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  for (const msg of messages) {
    const dateLabel = formatDate(msg.createdAt);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === dateLabel) last.messages.push(msg);
    else groupedMessages.push({ date: dateLabel, messages: [msg] });
  }

  return (
    <main style={{
      display: "flex", flexDirection: "column", height: "100%", minHeight: 0,
      fontFamily: "'Segoe UI', system-ui, sans-serif", background: C.bg,
    }}>
      {/* ── Channel header ── */}
      <div style={{
        padding: "0 20px", height: "52px", flexShrink: 0,
        background: C.bg, borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
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
            padding: "3px 9px", borderRadius: "100px",
            letterSpacing: "0.05em",
            ...(channelType === "VOICE"
              ? voiceState?.channelId === channelId
                ? { color: "#10b981", background: "rgba(16,185,129,0.12)" }
                : { color: C.t3,     background: "rgba(255,255,255,0.05)" }
              : connected
                ? { color: "#10b981", background: "rgba(16,185,129,0.12)" }
                : { color: C.red,     background: "rgba(239,68,68,0.12)"  }
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
            transition: "background 0.15s, border-color 0.15s",
            letterSpacing: "0.02em",
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
          <span style={{ fontSize: "12px", color: "#94a3b8", wordBreak: "break-all" }}>{inviteUrl}</span>
        </div>
      )}

      {/* Voice channel embed */}
      {channelType === "VOICE" && (
        <div style={{ background: C.bg, flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          <VoiceChannel channelId={channelId} />
        </div>
      )}

      {/* ── Message list ── */}
      <div
        style={{
          flex: 1, overflowY: "auto", padding: "8px 0 4px",
          display: channelType === "VOICE" ? "none" : "block", minHeight: 0,
        }}
        onClick={() => setShowEmojiPicker(null)}
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
                      (e.currentTarget as HTMLDivElement).style.backgroundColor = "rgba(255,255,255,0.025)";
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
                      <div style={{
                        width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
                        background: C.grad,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "12px", fontWeight: 700, color: "#fff", marginTop: "1px",
                      }}>
                        {initials(msg.author.name)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Name + time */}
                        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "3px" }}>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: C.t1 }}>{msg.author.name}</span>
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
                                background: C.card, border: `1px solid ${C.teal}`,
                                borderRadius: "8px", outline: "none", boxSizing: "border-box",
                                marginBottom: "6px", display: "block",
                                boxShadow: "0 0 0 3px rgba(66,219,188,0.1)",
                              }}
                            />
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button onClick={() => saveEdit(msg.id)} style={{
                                padding: "5px 12px", fontSize: "12px", fontWeight: 700, color: "#fff",
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
                            color: msg.deletedAt ? C.t3 : "#cbd5e1",
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
                                    background: reacted ? "rgba(66,219,188,0.12)" : "rgba(255,255,255,0.04)",
                                    color: reacted ? C.teal : C.t2, cursor: "pointer",
                                    transition: "all 0.12s",
                                  }}
                                  onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(66,219,188,0.5)";
                                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(66,219,188,0.12)";
                                  }}
                                  onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = reacted ? "rgba(66,219,188,0.5)" : C.border;
                                    (e.currentTarget as HTMLButtonElement).style.background = reacted ? "rgba(66,219,188,0.12)" : "rgba(255,255,255,0.04)";
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
                          <ActionBtn title="Edit" color="rgba(66,219,188,0.8)"
                            onClick={() => { setEditingId(msg.id); setEditingContent(msg.content || ""); }}>
                            ✏️
                          </ActionBtn>
                        )}
                        {canDelete && (
                          <ActionBtn title="Delete" color="#ef4444" onClick={() => deleteMessage(msg.id)}>
                            🗑️
                          </ActionBtn>
                        )}
                        {!msg.deletedAt && (
                          <div style={{ position: "relative" }}>
                            <ActionBtn title="React" color="#94a3b8"
                              onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id); }}>
                              😊
                            </ActionBtn>
                            {showEmojiPicker === msg.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: "absolute", bottom: "calc(100% + 6px)", right: 0,
                                  background: "#0d1827", border: `1px solid ${C.border}`,
                                  borderRadius: "10px", padding: "8px",
                                  display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "4px",
                                  zIndex: 20, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
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
                                    onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = "rgba(66,219,188,0.12)"}
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
          padding: "12px 20px 14px", background: C.bg,
          borderTop: `1px solid ${C.border}`, flexShrink: 0,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "0",
            background: inputFocused ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)",
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
                background: input.trim() ? C.grad : "rgba(255,255,255,0.07)",
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
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
        input::placeholder { color: #334155; }
      `}</style>
    </main>
  );
}

function ActionBtn({
  title, color, onClick, children,
}: {
  title: string; color: string; onClick: (e: React.MouseEvent) => void; children: React.ReactNode;
}) {
  return (
    <button
      title={title} onClick={onClick}
      style={{
        width: "26px", height: "26px", borderRadius: "6px", border: "none",
        background: "rgba(255,255,255,0.06)", color, fontSize: "12px",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)"}
      onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"}
    >
      {children}
    </button>
  );
}
