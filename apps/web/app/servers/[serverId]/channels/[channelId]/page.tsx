"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import VoiceChannel from "@/components/voice/VoiceChannel";

type Message = {
  id: string;
  content: string;
  authorId: string;
  author: { id: string; name: string };
  createdAt: string;
};

export default function ChannelPage() {
  const { data: session } = useSession();
  const params = useParams();
  const channelId = params.channelId as string;
  const serverId = params.serverId as string;
  const socket = getSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [channelType, setChannelType] = useState<"TEXT" | "VOICE" | null>(null);
  const [channelName, setChannelName] = useState("");
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
      });
  }, [serverId, channelId, session?.user?.id]);

  useEffect(() => {
    if (!channelId) return;

    socket.connect();

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

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("message:receive", handleMessage);

    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("message:receive", handleMessage);
    };
  }, [channelId]);

  useEffect(() => {
    if (!channelId) return;
    fetch(`http://localhost:3001/channels/${channelId}/messages`)
      .then((res) => res.json())
      .then((data: Message[]) => setMessages(data));
  }, [channelId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage() {
    if (!input.trim() || !session?.user?.id) return;
    socket.emit("message:send", {
      channelId,
      authorId: session.user.id,
      content: input,
    });
    setInput("");
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
        {messages.length === 0 && (
          <p
            style={{
              color: "#4b5a72",
              fontSize: "13px",
              textAlign: "center",
              marginTop: "40px",
            }}
          >
            No messages yet. Say hello!
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              gap: "10px",
              marginBottom: "14px",
            }}
          >
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
            <div>
              <p
                style={{
                  margin: "0 0 2px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#e2e8f0",
                }}
              >
                {msg.author.name}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "#cbd5e1",
                  background: "#161d2a",
                  border: "1px solid #1c2535",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  display: "inline-block",
                  maxWidth: "70%",
                }}
              >
                {msg.content}
              </p>
            </div>
          </div>
        ))}
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
