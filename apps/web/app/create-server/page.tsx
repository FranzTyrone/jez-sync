"use client";

import { getApiUrl } from '@/lib/config';
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function CreateServerPage() {
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!session?.user?.id) { setError("You must be logged in"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/servers`, {
        method: "POST", credentials: "include",
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
    } catch {
      setError("Something went wrong. Is the API server running?");
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      backgroundColor: "#07090f", fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: "24px", position: "relative", overflow: "hidden",
    }}>
      {/* Background orbs */}
      <div style={{
        position: "absolute", top: "-120px", right: "-80px",
        width: "400px", height: "400px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(66,219,188,0.1) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-150px", left: "-100px",
        width: "500px", height: "500px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(33,87,154,0.15) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />

      <div style={{
        width: "100%", maxWidth: "420px",
        backgroundColor: "rgba(11,17,30,0.9)",
        border: "1px solid rgba(66,219,188,0.15)",
        borderRadius: "20px", padding: "40px 36px",
        boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(66,219,188,0.05) inset",
        position: "relative", zIndex: 1,
        animation: "cardIn 0.5s cubic-bezier(0.16,1,0.3,1)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <Image src="/jezsync-logo.png" alt="Jez Sync" width={120} height={67}
            style={{ objectFit: "contain", mixBlendMode: "multiply",
              filter: "drop-shadow(0 2px 12px rgba(66,219,188,0.3)) brightness(1.1)" }}
            priority
          />
        </div>

        <div style={{ marginBottom: "28px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center",
            backgroundColor: "rgba(66,219,188,0.1)", border: "1px solid rgba(66,219,188,0.25)",
            borderRadius: "100px", padding: "4px 12px", marginBottom: "14px",
          }}>
            <span style={{ fontSize: "11px", color: "#42DBBC", fontWeight: 600, letterSpacing: "0.05em" }}>NEW WORKSPACE</span>
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#f1f5f9", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            Create your server
          </h1>
          <p style={{ fontSize: "13px", color: "#64748b", margin: 0, lineHeight: 1.6 }}>
            This is where you and your team will hang out. Give it a name — you can always change it later.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{
            display: "block", fontSize: "11px", fontWeight: 700,
            color: "#94a3b8", marginBottom: "7px",
            textTransform: "uppercase", letterSpacing: "0.07em",
          }}>
            Server name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="My Team"
            required minLength={2} maxLength={100}
            style={{
              width: "100%", padding: "12px 14px",
              backgroundColor: focused ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
              border: focused ? "1px solid rgba(66,219,188,0.7)" : "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px", fontSize: "14px", color: "#e2e8f0",
              outline: "none", boxSizing: "border-box",
              transition: "border-color 0.2s, background-color 0.2s, box-shadow 0.2s",
              boxShadow: focused ? "0 0 0 3px rgba(66,219,188,0.12)" : "none",
              marginBottom: error ? "12px" : "24px",
            }}
          />

          {error && (
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
              color: "#fca5a5", fontSize: "13px", padding: "10px 12px",
              borderRadius: "8px", marginBottom: "20px",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: "100%", padding: "13px", borderRadius: "10px", border: "none",
              background: loading ? "rgba(66,219,188,0.35)" : "linear-gradient(135deg, #42DBBC 0%, #21579A 100%)",
              color: "#fff", fontSize: "14px", fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 4px 20px rgba(66,219,188,0.35)",
              transition: "transform 0.12s ease, box-shadow 0.15s ease",
              letterSpacing: "0.02em",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 28px rgba(66,219,188,0.45)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(66,219,188,0.35)";
            }}
          >
            {loading ? "Creating…" : "Create server →"}
          </button>
        </form>

        <p style={{ fontSize: "12px", color: "#334155", textAlign: "center", marginTop: "20px" }}>
          Signed in as <span style={{ color: "#64748b", fontWeight: 600 }}>{session?.user?.name}</span>
        </p>
      </div>

      <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        input::placeholder { color: #2d3f55; }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 1000px #0b111e inset !important; -webkit-text-fill-color: #e2e8f0 !important; }
      `}</style>
    </main>
  );
}
