"use client";

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

    fetch(`http://localhost:3001/users/${session.user.id}/servers`)
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
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <p>Loading Jez Sync...</p>
    </main>
  );
}