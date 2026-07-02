"use client";

import { SessionProvider } from "next-auth/react";
import { VoiceProvider } from "@/lib/VoiceContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import { ProfileImageProvider } from "@/lib/ProfileImageContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ProfileImageProvider>
        <ThemeProvider>
          <VoiceProvider>{children}</VoiceProvider>
        </ThemeProvider>
      </ProfileImageProvider>
    </SessionProvider>
  );
}