"use client";

import { getApiUrl } from '@/lib/config';

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Server = {
  id: string;
  channels: { id: string }[];
};

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/login");
      return;
    }

    fetch(`${getApiUrl()}/users/${session.user.id}/servers`)
      .then((res) => res.json())
      .then((servers: Server[]) => {
        if (servers.length > 0 && servers[0].channels.length > 0) {
          router.push(`/servers/${servers[0].id}/channels/${servers[0].channels[0].id}`);
        } else {
          router.push("/create-server");
        }
      });
  }, [session, status, router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0d1117",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        gap: "20px",
      }}
    >
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          border: "2.5px solid #252f42",
          borderTopColor: "#6366f1",
          animation: "spin 0.75s linear infinite",
        }}
      />
      <p
        style={{
          color: "#6b7280",
          fontSize: "14px",
          margin: 0,
          letterSpacing: "0.01em",
        }}
      >
        Jez Sync
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}