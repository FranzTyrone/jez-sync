"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function CreateServerPage() {
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!session?.user?.id) {
      setError("You must be logged in");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://localhost:3001/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ownerId: session.user.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create server");
        setLoading(false);
        return;
      }

      const data = await res.json();
      router.push(`/servers/${data.serverId}/channels/${data.channelId}`);
    } catch (err) {
      setError("Something went wrong. Is the API server running?");
      setLoading(false);
    }
  }

  const shellStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0b1830",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: "24px",
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "440px",
    background: "#161d2a",
    border: "1px solid #252f42",
    borderRadius: "16px",
    padding: "40px 36px",
  };

  if (!session) {
    return (
      <main style={shellStyle}>
        <div style={cardStyle}>
          <p style={{ color: "#9ca3af", fontSize: "15px", margin: 0 }}>
            You must be logged in.{" "}
            <a href="/login" style={{ color: "#6366f1", textDecoration: "none" }}>
              Log in
            </a>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={shellStyle}>
      <div style={cardStyle}>
        <p
          style={{
            color: "#6366f1",
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            margin: "0 0 12px",
          }}
        >
          Almost there
        </p>

        <h1
          style={{
            color: "#f3f4f6",
            fontSize: "24px",
            fontWeight: 600,
            margin: "0 0 8px",
          }}
        >
          Create your server
        </h1>

        <p
          style={{
            color: "#9ca3af",
            fontSize: "14px",
            margin: "0 0 28px",
          }}
        >
          This is where you and your team will hang out. Give it a name —
          you can always change it later.
        </p>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="server-name"
            style={{
              display: "block",
              color: "#9ca3af",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            Server name
          </label>
          <input
            id="server-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Team"
            required
            minLength={2}
            maxLength={100}
            style={{
              width: "100%",
              padding: "12px 14px",
              fontSize: "15px",
              color: "#f3f4f6",
              background: "#0d1117",
              border: "1px solid #252f42",
              borderRadius: "10px",
              outline: "none",
              boxSizing: "border-box",
              marginBottom: error ? "12px" : "24px",
              transition: "border-color 0.15s ease",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#252f42")}
          />

          {error && (
            <p
              style={{
                color: "#f87171",
                fontSize: "13px",
                margin: "0 0 20px",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "15px",
              fontWeight: 600,
              color: "#fff",
              background: loading ? "#4b4fd1" : "#6366f1",
              border: "none",
              borderRadius: "10px",
              cursor: loading ? "default" : "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.background = "#7c7ff2";
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.background = "#6366f1";
            }}
          >
            {loading ? "Creating..." : "Create server"}
          </button>
        </form>

        <p
          style={{
            color: "#6b7280",
            fontSize: "13px",
            textAlign: "center",
            margin: "24px 0 0",
          }}
        >
          Logged in as <strong style={{ color: "#9ca3af" }}>{session.user?.name}</strong>
        </p>
      </div>
    </main>
  );
}