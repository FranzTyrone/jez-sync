"use client";

import { createContext, useContext, useRef, useState } from "react";

export type VoiceState = {
  isSharing: boolean;
  channelId: string;
};

export type VoiceActions = {
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleShare: () => void;
  leaveVoice: () => void;
};

export type VoicePrefs = {
  isMuted: boolean;
  isDeafened: boolean;
  lastChannelId: string | null;
};

type VoiceContextValue = {
  voiceState: VoiceState | null;
  actionsRef: React.MutableRefObject<VoiceActions | null>;
  setVoiceState: (s: VoiceState | null) => void;
  voicePrefs: VoicePrefs;
  setVoicePrefs: React.Dispatch<React.SetStateAction<VoicePrefs>>;
};

const VoiceContext = createContext<VoiceContextValue | null>(null);

const defaultPrefs: VoicePrefs = {
  isMuted: false,
  isDeafened: false,
  lastChannelId: null,
};

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [voiceState, setVoiceState] = useState<VoiceState | null>(null);
  const [voicePrefs, setVoicePrefs] = useState<VoicePrefs>(defaultPrefs);
  const actionsRef = useRef<VoiceActions | null>(null);

  return (
    <VoiceContext.Provider value={{ voiceState, actionsRef, setVoiceState, voicePrefs, setVoicePrefs }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used inside VoiceProvider");
  return ctx;
}
