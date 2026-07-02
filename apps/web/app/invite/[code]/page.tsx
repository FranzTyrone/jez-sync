"use client";

import { getApiUrl } from '@/lib/config';

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";

type InviteInfo = {
  serverId: string;
  serverName: string;
  memberCount: number;
};

export default function InvitePage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!code) return;

    fetch(`${getApiUrl()}/invites/${code}`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error("Invite not found");
        return res.json();
      })
      .then((data: InviteInfo) => setInvite(data))
      .catch(() => setError("This invite is invalid or has expired."));
  }, [code]);

  async function handleJoin() {
    if (!session?.user?.id) {
      router.push(`/login?callbackUrl=/invite/${code}`);
      return;
    }

    setJoining(true);

    const res = await fetch(`${getApiUrl()}/invites/${code}/join`, {
      method: "POST", credentials: 'include',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.user.id }),
    });

    const data = await res.json();

    if (res.ok) {
      router.push(`/servers/${data.serverId}/channels/${data.channelId}`);
    } else {
      setError(data.error || "Failed to join");
      setJoining(false);
    }
  }

  const shellStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0d1117",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: "24px",
    position: "relative",
    overflow: "hidden",
  };

  const glowStyle: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "700px",
    height: "700px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)",
    pointerEvents: "none",
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "420px",
    background: "#161d2a",
    border: "1px solid #252f42",
    borderRadius: "20px",
    padding: "44px 40px",
    position: "relative",
    zIndex: 1,
    textAlign: "center",
  };

  if (error) {
    return (
      <main style={shellStyle}>
        <div style={glowStyle} />
        <div style={{ ...cardStyle, padding: "44px 40px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: "24px",
              color: "#f87171",
            }}
          >
            ✕
          </div>
          <h2
            style={{
              color: "#f3f4f6",
              fontSize: "20px",
              fontWeight: 600,
              margin: "0 0 8px",
            }}
          >
            Invite not found
          </h2>
          <p
            style={{
              color: "#9ca3af",
              fontSize: "14px",
              margin: "0 0 28px",
              lineHeight: "1.55",
            }}
          >
            {error}
          </p>
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: "10px 24px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#6366f1",
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.22)",
              borderRadius: "10px",
              textDecoration: "none",
            }}
          >
            Back to home
          </a>
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </main>
    );
  }

  if (!invite) {
    return (
      <main style={shellStyle}>
        <div style={glowStyle} />
        <div style={{ ...cardStyle, padding: "48px 40px" }}>
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "#252f42",
              margin: "0 auto 24px",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          <div
            style={{
              height: "12px",
              borderRadius: "6px",
              background: "#252f42",
              margin: "0 auto 14px",
              width: "110px",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          <div
            style={{
              height: "26px",
              borderRadius: "13px",
              background: "#252f42",
              margin: "0 auto 14px",
              width: "200px",
              animation: "pulse 1.5s ease-in-out 0.15s infinite",
            }}
          />
          <div
            style={{
              height: "11px",
              borderRadius: "6px",
              background: "#252f42",
              margin: "0 auto 36px",
              width: "80px",
              animation: "pulse 1.5s ease-in-out 0.3s infinite",
            }}
          />
          <div
            style={{
              height: "44px",
              borderRadius: "12px",
              background: "#252f42",
              animation: "pulse 1.5s ease-in-out 0.45s infinite",
            }}
          />
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </main>
    );
  }

  const initials = invite.serverName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => (w[0] ?? "").toUpperCase())
    .join("");

  const isLoggedIn = !!session?.user?.id;

  return (
    <main style={shellStyle}>
      <div style={glowStyle} />

      <div style={cardStyle} className="invite-card">
        {/* Server avatar with glow ring */}
        <div
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "-6px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #818cf8)",
              opacity: 0.35,
              filter: "blur(10px)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "relative",
              width: "84px",
              height: "84px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
              border: "2px solid rgba(99,102,241,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: initials.length > 1 ? "26px" : "30px",
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.01em",
              flexShrink: 0,
            }}
          >
            {initials || "#"}
          </div>
        </div>

        {/* Eyebrow */}
        <p
          style={{
            color: "#6366f1",
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            margin: "0 0 8px",
          }}
        >
          You're invited to
        </p>

        {/* Server name */}
        <h1
          style={{
            color: "#f3f4f6",
            fontSize: "26px",
            fontWeight: 700,
            margin: "0 0 12px",
            letterSpacing: "-0.02em",
            lineHeight: "1.2",
          }}
        >
          {invite.serverName}
        </h1>

        {/* Member count */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "#9ca3af",
            fontSize: "14px",
            marginBottom: "32px",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#22c55e",
              flexShrink: 0,
              boxShadow: "0 0 6px rgba(34,197,94,0.5)",
            }}
          />
          {invite.memberCount.toLocaleString()} member
          {invite.memberCount !== 1 ? "s" : ""}
        </div>

        {/* CTA */}
        {isLoggedIn ? (
          <>
            <button
              onClick={handleJoin}
              disabled={joining}
              style={{
                width: "100%",
                padding: "13px",
                fontSize: "15px",
                fontWeight: 600,
                color: "#fff",
                background: joining ? "#4b4fd1" : "#6366f1",
                border: "none",
                borderRadius: "12px",
                cursor: joining ? "default" : "pointer",
                transition: "background 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease",
                boxShadow: "0 4px 20px rgba(99,102,241,0.28)",
              }}
              onMouseEnter={(e) => {
                if (!joining) {
                  e.currentTarget.style.background = "#7c7ff2";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 6px 24px rgba(99,102,241,0.4)";
                }
              }}
              onMouseLeave={(e) => {
                if (!joining) {
                  e.currentTarget.style.background = "#6366f1";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.28)";
                }
              }}
            >
              {joining ? "Joining..." : "Accept Invite"}
            </button>
            <p
              style={{
                color: "#6b7280",
                fontSize: "13px",
                margin: "14px 0 0",
              }}
            >
              Joining as{" "}
              <strong style={{ color: "#9ca3af", fontWeight: 500 }}>
                {session.user?.name}
              </strong>
            </p>
          </>
        ) : (
          <>
            <button
              onClick={handleJoin}
              style={{
                width: "100%",
                padding: "13px",
                fontSize: "15px",
                fontWeight: 600,
                color: "#fff",
                background: "#6366f1",
                border: "none",
                borderRadius: "12px",
                cursor: "pointer",
                transition: "background 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease",
                boxShadow: "0 4px 20px rgba(99,102,241,0.28)",
                marginBottom: "14px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#7c7ff2";
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 6px 24px rgba(99,102,241,0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#6366f1";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.28)";
              }}
            >
              Log in to Join
            </button>
            <p style={{ color: "#6b7280", fontSize: "13px", margin: 0 }}>
              No account?{" "}
              <a
                href={`/register?callbackUrl=/invite/${code}`}
                style={{
                  color: "#6366f1",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                Sign up free
              </a>
            </p>
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 440px) {
          .invite-card { padding: 36px 24px !important; }
        }
      `}</style>
    </main>
  );
}
