"use client";

import { getApiUrl } from '@/lib/config';
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Server = { id: string; channels: { id: string }[] };

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user?.id) { router.push("/login"); return; }
    fetch(`${getApiUrl()}/users/${session.user.id}/servers`, { credentials: "include" })
      .then((r) => r.json())
      .then((servers: Server[]) => {
        const first = servers[0];
        if (first && first.channels.length > 0) {
          router.push(`/servers/${first.id}/channels/${first.channels[0]!.id}`);
        } else {
          router.push("/create-server");
        }
      });
  }, [session, status, router]);

  return (
    <main style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      backgroundColor: "#07090f",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      gap: "16px",
    }}>
      {/* Spinner */}
      <div style={{ position: "relative", width: "44px", height: "44px" }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: "2.5px solid rgba(66,219,188,0.15)",
        }} />
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: "2.5px solid transparent",
          borderTopColor: "#42DBBC",
          animation: "spin 0.75s linear infinite",
        }} />
      </div>
      <p style={{ color: "#475569", fontSize: "13px", margin: 0, letterSpacing: "0.03em" }}>
        Jez Sync
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
