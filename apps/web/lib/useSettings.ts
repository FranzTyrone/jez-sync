"use client";

import { useEffect, useState } from "react";

export type MessageDensity = "comfortable" | "compact";

export type AppSettings = {
  // Voice & Video
  micDeviceId:        string;
  speakerDeviceId:    string;
  cameraDeviceId:     string;
  noiseSuppression:   boolean;
  echoCancellation:   boolean;
  autoGainControl:    boolean;

  // Notifications
  desktopNotifications: boolean;
  messageSound:         boolean;
  mentionSound:         boolean;

  // Appearance
  messageDensity: MessageDensity;
  fontSize:       number;         // 12–16px
};

const DEFAULTS: AppSettings = {
  micDeviceId:          "default",
  speakerDeviceId:      "default",
  cameraDeviceId:       "default",
  noiseSuppression:     true,
  echoCancellation:     true,
  autoGainControl:      true,
  desktopNotifications: false,
  messageSound:         true,
  mentionSound:         true,
  messageDensity:       "comfortable",
  fontSize:             14,
};

const KEY = "jezsync_settings";

function load(): AppSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULTS);

  useEffect(() => {
    setSettingsState(load());
  }, []);

  function update(patch: Partial<AppSettings>) {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  return { settings, update };
}
