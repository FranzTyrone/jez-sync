"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import VoiceChannel from "@/components/voice/VoiceChannel";
import { useVoice } from "@/lib/VoiceContext";

type Reaction = {
  emoji: string;
  count: number;
  userIds: string[];
};

type Message = {
  id: string;
  content: string | null;
  authorId: string;
  author: { id: string; name: string };
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  reactions?: Reaction[];
};

const EMOJI_SET = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

export default function ChannelPage() {
  const { data: session } = useSession();
  const params = useParams();
  const channelId = params.channelId as string;
  const serverId = params.serverId as string;
  const socket = getSocket();
  const { voiceState } = useVoice();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [channelType, setChannelType] = useState<"TEXT" | "VOICE" | null>(null);
  const [channelName, setChannelName] = useState("");
  const [serverOwnerId, setServerOwnerId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!serverId || !session?.user?.id) return;
    fetch(`http://localhost:3001/users/${session.user.id}/servers`)
      .then((res) => res.json())
      .then((servers: any[]) => {
        const server = servers.find((s) => s.id === serverId);
        const channel = server?.channels.find((c: any) => c.id === channelId);
        if (channel) {
          setChannelType(channel.type);
          setChannelName(channel.name);
        }
        if (server) {
          setServerOwnerId(server.ownerId);
        }
      });
  }, [serverId, channelId, session?.user?.id]);

  useEffect(() => {
    if (!channelId || !session?.user?.id) return;

    socket.connect();
    socket.emit("user:auth", { userId: session.user.id });

    function handleConnect() {
      setConnected(true);
      socket.emit("channel:join", channelId);
    }
    function handleDisconnect() {
      setConnected(false);
    }
    function handleMessage(message: Message) {
      setMessages((prev) => [...prev, message]);
    }
    function handleMessageUpdated(message: Message) {
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? message : m))
      );
      setEditingId(null);
      setEditingContent("");
    }
    function handleMessageDeleted(data: { messageId: string; deletedAt: string }) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId ? { ...m, deletedAt: data.deletedAt, content: null } : m
        )
      );
    }
    function handleReactionsUpdated(data: {
      messageId: string;
      reactions: Reaction[];
    }) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId ? { ...m, reactions: data.reactions } : m
        )
      );
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("message:receive", handleMessage);
    socket.on("message:updated", handleMessageUpdated);
    socket.on("message:deleted", handleMessageDeleted);
    socket.on("message:reactions", handleReactionsUpdated);

    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("message:receive", handleMessage);
      socket.off("message:updated", handleMessageUpdated);
      socket.off("message:deleted", handleMessageDeleted);
      socket.off("message:reactions", handleReactionsUpdated);
    };
  }, [channelId, session?.user?.id]);

  useEffect(() => {
    if (!channelId || !session?.user?.id) return;
    const url = new URL(`http://localhost:3001/channels/${channelId}/messages`);
    url.searchParams.set("userId", session.user.id);
    fetch(url.toString())
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          console.error("Fetch failed:", res.status, text);
          setMessages([]);
          return;
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          setMessages(data);
        } else {
          console.error("Response is not an array:", data);
          setMessages([]);
        }
      })
      .catch((err) => {
        console.error("Message fetch error:", err.message, err.stack);
        setMessages([]);
      });
  }, [channelId, session?.user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    if (!window.confirm("Delete this message? This cannot be undone.")) return;
    socket.emit("message:delete", { messageId });
  }

  function toggleReaction(messageId: string, emoji: string) {
    socket.emit("message:react", { messageId, emoji });
  }

  async function generateInvite() {
    if (!session?.user?.id) return;
    const res = await fetch(
      `http://localhost:3001/servers/${serverId}/invites`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createdBy: session.user.id }),
      },
    );
    const data = await res.json();
    setInviteUrl(data.url);
  }

  function initialsOf(name: string) {
    return name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  if (!session) {
    return (
      <main
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          fontFamily: "'Segoe UI', sans-serif",
          background: "#0d1117",
        }}
      >
        <p style={{ color: "#8897ae" }}>
          You must be logged in.{" "}
          <a href="/login" style={{ color: "#6366f1", fontWeight: 600 }}>
            Log in
          </a>
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        fontFamily: "'Segoe UI', sans-serif",
        background: "#0d1117",
      }}
    >
      <div
        style={{
          padding: "14px 20px",
          background: "#0d1117",
          borderBottom: "1px solid #252f42",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "#4b5a72", fontSize: "18px" }}>
            {channelType === "VOICE" ? "\u{1F50A}" : "#"}
          </span>
          <h1
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#e2e8f0",
              margin: 0,
            }}
          >
            {channelName || "..."}
          </h1>
          {channelType === "VOICE" ? (
            <span
              style={{
                fontSize: "11px",
                color: voiceState?.channelId === channelId ? "#10b981" : "#4b5a72",
                background: voiceState?.channelId === channelId ? "#0d2b20" : "transparent",
                padding: "2px 8px",
                borderRadius: "10px",
                fontWeight: 600,
              }}
            >
              {voiceState?.channelId === channelId ? "Voice Connected" : "Not in Voice"}
            </span>
          ) : (
            <span
              style={{
                fontSize: "11px",
                color: connected ? "#10b981" : "#ef4444",
                background: connected ? "#0d2b20" : "#2d1515",
                padding: "2px 8px",
                borderRadius: "10px",
                fontWeight: 600,
              }}
            >
              {connected ? "Connected" : "Disconnected"}
            </span>
          )}
        </div>

        <button
          onClick={generateInvite}
          style={{
            padding: "7px 14px",
            borderRadius: "8px",
            border: "1px solid #252f42",
            background: "#161d2a",
            color: "#e2e8f0",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Invite people
        </button>
      </div>

      {inviteUrl && (
        <div
          style={{
            background: "#0d2b20",
            borderBottom: "1px solid #064e3b",
            padding: "10px 20px",
            fontSize: "13px",
            color: "#10b981",
            wordBreak: "break-all",
            flexShrink: 0,
          }}
        >
          {inviteUrl}
        </div>
      )}

      {channelType === "VOICE" && (
        <div
          style={{
            background: "#0d1117",
            flex: 1,
            display: "flex",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          <VoiceChannel channelId={channelId} />
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          background: "#0d1117",
          display: channelType === "VOICE" ? "none" : "block",
          minHeight: 0,
        }}
      >
        {!Array.isArray(messages) || messages.length === 0 ? (
          <p
            style={{
              color: "#4b5a72",
              fontSize: "13px",
              textAlign: "center",
              marginTop: "40px",
            }}
          >
            {Array.isArray(messages) ? "No messages yet. Say hello!" : "Loading messages..."}
          </p>
        ) : (
          messages.map((msg) => {
            const canEdit = msg.authorId === session.user?.id && !msg.deletedAt;
            const canDelete =
              (msg.authorId === session.user?.id || serverOwnerId === session.user?.id) &&
              !msg.deletedAt;
            const isEditing = editingId === msg.id;

            return (
              <div
                key={msg.id}
                style={{ marginBottom: "14px", position: "relative" }}
                onMouseEnter={(e) => {
                  const menu = e.currentTarget.querySelector("[data-menu]") as HTMLElement;
                  if (menu) menu.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  const menu = e.currentTarget.querySelector("[data-menu]") as HTMLElement;
                  if (menu) menu.style.opacity = "0";
                }}
              >
                <div style={{ display: "flex", gap: "10px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "#1e2d45",
                      border: "1.5px solid #252f42",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#e2e8f0",
                      fontSize: "11px",
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {initialsOf(msg.author.name)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#e2e8f0" }}>
                        {msg.author.name}
                      </p>
                      <span style={{ fontSize: "11px", color: "#4b5a72" }}>
                        {new Date(msg.createdAt).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {msg.editedAt && (
                        <span style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>
                          (edited)
                        </span>
                      )}
                    </div>

                    {isEditing ? (
                      <div style={{ marginBottom: "8px" }}>
                        <input
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) saveEdit(msg.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                          style={{
                            width: "100%",
                            maxWidth: "70%",
                            padding: "8px 12px",
                            fontSize: "14px",
                            color: "#e2e8f0",
                            background: "#161d2a",
                            border: "1px solid #6366f1",
                            borderRadius: "8px",
                            outline: "none",
                            boxSizing: "border-box",
                            marginBottom: "6px",
                            display: "block",
                          }}
                        />
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={() => saveEdit(msg.id)}
                            style={{
                              padding: "6px 12px",
                              fontSize: "12px",
                              fontWeight: 600,
                              color: "#fff",
                              background: "#6366f1",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            style={{
                              padding: "6px 12px",
                              fontSize: "12px",
                              color: "#9ca3af",
                              background: "transparent",
                              border: "1px solid #252f42",
                              borderRadius: "6px",
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p
                        style={{
                          margin: 0,
                          fontSize: "14px",
                          color: msg.deletedAt ? "#4b5a72" : "#cbd5e1",
                          fontStyle: msg.deletedAt ? "italic" : "normal",
                          background: "#161d2a",
                          border: "1px solid #1c2535",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          display: "inline-block",
                          maxWidth: "70%",
                        }}
                      >
                        {msg.deletedAt ? "(message deleted)" : msg.content}
                      </p>
                    )}

                    {!msg.deletedAt && (msg.reactions ?? []).length > 0 && (
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
                        {(msg.reactions ?? []).map((r) => (
                          <button
                            key={r.emoji}
                            onClick={() => toggleReaction(msg.id, r.emoji)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 8px",
                              borderRadius: "12px",
                              border: r.userReacted ? "1px solid #6366f1" : "1px solid #252f42",
                              background: r.userReacted ? "rgba(99,102,241,0.15)" : "transparent",
                              color: "#cbd5e1",
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.borderColor = "#6366f1";
                              (e.currentTarget as HTMLButtonElement).style.background =
                                "rgba(99,102,241,0.2)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.borderColor = r.userReacted
                                ? "#6366f1"
                                : "#252f42";
                              (e.currentTarget as HTMLButtonElement).style.background = r.userReacted
                                ? "rgba(99,102,241,0.15)"
                                : "transparent";
                            }}
                          >
                            <span>{r.emoji}</span>
                            <span>{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    data-menu
                    style={{
                      display: "flex",
                      gap: "4px",
                      opacity: 0,
                      transition: "opacity 0.15s ease",
                      alignItems: "flex-start",
                      paddingTop: "2px",
                    }}
                  >
                    {canEdit && (
                      <button
                        onClick={() => {
                          setEditingId(msg.id);
                          setEditingContent(msg.content || "");
                        }}
                        title="Edit"
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "4px",
                          border: "none",
                          background: "rgba(99,102,241,0.1)",
                          color: "#6366f1",
                          fontSize: "12px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "rgba(99,102,241,0.25)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "rgba(99,102,241,0.1)";
                        }}
                      >
                        ✏️
                      </button>
                    )}

                    {canDelete && (
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        title="Delete"
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "4px",
                          border: "none",
                          background: "rgba(239,68,68,0.1)",
                          color: "#ef4444",
                          fontSize: "12px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "rgba(239,68,68,0.25)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "rgba(239,68,68,0.1)";
                        }}
                      >
                        🗑️
                      </button>
                    )}

                    {!msg.deletedAt && (
                      <div style={{ position: "relative" }}>
                        <button
                          onClick={() =>
                            setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)
                          }
                          title="React"
                          style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "4px",
                            border: "none",
                            background: "rgba(59,130,246,0.1)",
                            color: "#3b82f6",
                            fontSize: "12px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background =
                              "rgba(59,130,246,0.25)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background =
                              "rgba(59,130,246,0.1)";
                          }}
                        >
                          😊
                        </button>

                        {showEmojiPicker === msg.id && (
                          <div
                            style={{
                              position: "absolute",
                              bottom: "100%",
                              right: 0,
                              background: "#161d2a",
                              border: "1px solid #252f42",
                              borderRadius: "8px",
                              padding: "8px",
                              display: "grid",
                              gridTemplateColumns: "repeat(3, 1fr)",
                              gap: "4px",
                              zIndex: 10,
                              marginBottom: "4px",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {EMOJI_SET.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => {
                                  toggleReaction(msg.id, emoji);
                                  setShowEmojiPicker(null);
                                }}
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  fontSize: "16px",
                                  border: "none",
                                  background: "transparent",
                                  cursor: "pointer",
                                  borderRadius: "4px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                                onMouseEnter={(e) => {
                                  (e.currentTarget as HTMLButtonElement).style.background =
                                    "rgba(99,102,241,0.15)";
                                }}
                                onMouseLeave={(e) => {
                                  (e.currentTarget as HTMLButtonElement).style.background =
                                    "transparent";
                                }}
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
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {channelType !== "VOICE" && (
        <div
          style={{
            padding: "14px 20px",
            background: "#0d1117",
            borderTop: "1px solid #252f42",
            display: "flex",
            gap: "10px",
            flexShrink: 0,
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={`Message #${channelName}`}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #252f42",
              background: "#161d2a",
              color: "#e2e8f0",
              fontSize: "14px",
              outline: "none",
            }}
          />
          <button
            onClick={sendMessage}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background: "#6366f1",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Send
          </button>
        </div>
      )}
    </main>
  );
}
