"use client";

import { SessionProvider } from "next-auth/react";
import { VoiceProvider } from "@/lib/VoiceContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <VoiceProvider>{children}</VoiceProvider>
    </SessionProvider>
  );
}