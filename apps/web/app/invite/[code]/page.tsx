"use client";

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

    fetch(`http://localhost:3001/invites/${code}`)
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

    const res = await fetch(`http://localhost:3001/invites/${code}/join`, {
      method: "POST",
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

  if (error) {
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p style={{ color: "red" }}>{error}</p>
      </main>
    );
  }

  if (!invite) {
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>Loading invite...</p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", maxWidth: "400px", fontFamily: "sans-serif" }}>
      <h1>You're invited to</h1>
      <h2>{invite.serverName}</h2>
      <p>{invite.memberCount} member{invite.memberCount !== 1 ? "s" : ""}</p>

      {session ? (
        <button
          onClick={handleJoin}
          disabled={joining}
          style={{ padding: "10px 20px", marginTop: "1rem" }}
        >
          {joining ? "Joining..." : `Join as ${session.user?.name}`}
        </button>
      ) : (
        <div>
          <p>You need to log in first.</p>
          <button onClick={handleJoin} style={{ padding: "10px 20px" }}>
            Log in to join
          </button>
        </div>
      )}
    </main>
  );
}