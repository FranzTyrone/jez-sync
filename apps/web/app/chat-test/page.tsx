"use client";

import { getApiUrl } from '@/lib/config';

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { socket } from "@/lib/socket";

const CHANNEL_ID = "1122d9d0-7170-455e-899c-c768cb556cf2";

type Message = {
  id: string;
  content: string;
  authorId: string;
  author: { id: string; name: string };
  createdAt: string;
};

export default function ChatTestPage() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    socket.connect();

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("channel:join", CHANNEL_ID);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("message:receive", (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.disconnect();
      socket.off("connect");
      socket.off("disconnect");
      socket.off("message:receive");
    };
  }, []);

  useEffect(() => {
    fetch(`${getApiUrl()}/channels/${CHANNEL_ID}/messages`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data: Message[]) => setMessages(data));
  }, []);

  function sendMessage() {
    if (!input.trim() || !session?.user?.id) return;
    socket.emit("message:send", {
      channelId: CHANNEL_ID,
      authorId: session.user.id,
      content: input,
    });
    setInput("");
  }

  if (!session) {
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>You must be logged in to use chat. <a href="/login">Log in</a></p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", maxWidth: "500px", fontFamily: "sans-serif" }}>
      <h1>#general</h1>
      <p>
        Status: {connected ? "🟢 Connected" : "🔴 Disconnected"} — logged in as{" "}
        <strong>{session.user?.name}</strong>
      </p>

      <div
        style={{
          border: "1px solid #ccc",
          height: "300px",
          overflowY: "auto",
          padding: "8px",
          marginBottom: "1rem",
        }}
      >
        {messages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: "4px" }}>
            <strong>{msg.author.name}:</strong> {msg.content}
          </div>
        ))}
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        style={{ width: "70%", padding: "8px" }}
        placeholder="Type a message..."
      />
      <button onClick={sendMessage} style={{ padding: "8px 16px", marginLeft: "8px" }}>
        Send
      </button>
    </main>
  );
}