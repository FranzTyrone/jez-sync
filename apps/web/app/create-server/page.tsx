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

  if (!session) {
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>You must be logged in. <a href="/login">Log in</a></p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", maxWidth: "400px", fontFamily: "sans-serif" }}>
      <h1>Create your server</h1>
      <p>Logged in as <strong>{session.user?.name}</strong></p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <label>Server name</label>
          <br />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", padding: "8px" }}
            placeholder="My Team"
            required
            minLength={2}
            maxLength={100}
          />
        </div>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <button type="submit" disabled={loading} style={{ padding: "8px 16px" }}>
          {loading ? "Creating..." : "Create Server"}
        </button>
      </form>
    </main>
  );
}