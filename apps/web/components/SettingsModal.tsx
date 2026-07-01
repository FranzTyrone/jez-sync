"use client";

import { getApiUrl } from "@/lib/config";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useSettings } from "@/lib/useSettings";

// ─── Design tokens ───────────────────────────────────────────
const C = {
  bg:     "#07090f",
  panel:  "#0c1628",
  card:   "#111d2e",
  border: "rgba(255,255,255,0.07)",
  t1:     "#f1f5f9",
  t2:     "#94a3b8",
  t3:     "#475569",
  teal:   "#42DBBC",
  blue:   "#21579A",
  grad:   "linear-gradient(135deg, #42DBBC 0%, #21579A 100%)",
  red:    "#ef4444",
  green:  "#10b981",
};

type Tab =
  | "account"
  | "voice"
  | "notifications"
  | "appearance"
  | "trash"
  | "shortcuts";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "account",       label: "My Account",        icon: "👤" },
  { id: "voice",         label: "Voice & Video",      icon: "🎙️" },
  { id: "notifications", label: "Notifications",      icon: "🔔" },
  { id: "appearance",    label: "Appearance",         icon: "🎨" },
  { id: "trash",         label: "Board Trash",        icon: "🗑️" },
  { id: "shortcuts",     label: "Keyboard Shortcuts", icon: "⌨️" },
];

// ─── Account tab ─────────────────────────────────────────────
function AccountTab() {
  const { data: session, update: updateSession } = useSession();
  const [name, setName] = useState(session?.user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function saveName() {
    if (!name.trim() || name.trim() === session?.user?.name) return;
    setSaving(true); setError("");
    const res = await fetch(`${getApiUrl()}/users/${session?.user?.id}/profile`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to save"); return; }
    await updateSession({ name: name.trim() });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Section title="My Account">
      <FieldGroup label="Display Name">
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            style={inputStyle}
          />
          <button
            onClick={saveName}
            disabled={saving || !name.trim() || name.trim() === session?.user?.name}
            style={{
              ...btnGrad,
              opacity: saving || !name.trim() || name.trim() === session?.user?.name ? 0.5 : 1,
            }}
          >
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save"}
          </button>
        </div>
        {error && <p style={{ margin: "6px 0 0", fontSize: "12px", color: C.red }}>{error}</p>}
      </FieldGroup>

      <FieldGroup label="Email">
        <input value={session?.user?.email ?? ""} readOnly style={{ ...inputStyle, opacity: 0.5, cursor: "default" }} />
        <p style={{ margin: "6px 0 0", fontSize: "12px", color: C.t3 }}>
          Email cannot be changed after registration.
        </p>
      </FieldGroup>

      <FieldGroup label="Avatar">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "50%",
            background: C.grad, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "22px", fontWeight: 700, color: "#fff",
          }}>
            {(name || session?.user?.name || "?").split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: C.t3, lineHeight: 1.6 }}>
            Your avatar is generated from your initials.<br />
            Change your display name to change the initials.
          </p>
        </div>
      </FieldGroup>
    </Section>
  );
}

// ─── Voice & Video tab ───────────────────────────────────────
function VoiceTab() {
  const { settings, update } = useSettings();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [micLevel, setMicLevel] = useState(0);
  const [testing, setTesting] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const rafRef      = useRef<number>(0);

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then(setDevices).catch(() => {});
    return () => stopTest();
  }, []);

  const mics     = devices.filter((d) => d.kind === "audioinput");
  const speakers = devices.filter((d) => d.kind === "audiooutput");
  const cameras  = devices.filter((d) => d.kind === "videoinput");

  async function startTest() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: settings.micDeviceId !== "default" ? { exact: settings.micDeviceId } : undefined,
          noiseSuppression: settings.noiseSuppression,
          echoCancellation: settings.echoCancellation,
          autoGainControl:  settings.autoGainControl,
        },
      });
      streamRef.current = stream;
      const ctx      = new AudioContext();
      const source   = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      setTesting(true);
      const data = new Uint8Array(analyser.frequencyBinCount);
      function tick() {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
        rafRef.current = requestAnimationFrame(tick);
      }
      tick();
      // Enumerate again to get labels after permission granted
      navigator.mediaDevices.enumerateDevices().then(setDevices).catch(() => {});
    } catch { /* permission denied */ }
  }

  function stopTest() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current   = null;
    analyserRef.current = null;
    setTesting(false);
    setMicLevel(0);
  }

  return (
    <div>
      <Section title="Microphone">
        <FieldGroup label="Input Device">
          <select value={settings.micDeviceId} onChange={(e) => update({ micDeviceId: e.target.value })} style={selectStyle}>
            <option value="default">Default microphone</option>
            {mics.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 8)}`}</option>)}
          </select>
        </FieldGroup>

        <FieldGroup label="Mic Test">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={testing ? stopTest : startTest} style={{ ...btnGrad, minWidth: "100px" }}>
              {testing ? "Stop Test" : "Test Mic"}
            </button>
            {testing && (
              <div style={{ flex: 1, height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "10px", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${micLevel}%`,
                  background: micLevel > 70 ? C.red : micLevel > 40 ? "#f59e0b" : C.teal,
                  transition: "width 0.05s ease, background 0.1s",
                  borderRadius: "10px",
                }} />
              </div>
            )}
          </div>
        </FieldGroup>

        <FieldGroup label="Audio Processing">
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <Toggle label="Noise Suppression"     checked={settings.noiseSuppression}   onChange={(v) => update({ noiseSuppression: v })}   description="Reduces background noise during calls" />
            <Toggle label="Echo Cancellation"     checked={settings.echoCancellation}   onChange={(v) => update({ echoCancellation: v })}   description="Prevents echo and feedback loops" />
            <Toggle label="Auto Gain Control"     checked={settings.autoGainControl}    onChange={(v) => update({ autoGainControl: v })}    description="Automatically adjusts microphone volume" />
          </div>
        </FieldGroup>
      </Section>

      <Section title="Speaker">
        <FieldGroup label="Output Device">
          <select value={settings.speakerDeviceId} onChange={(e) => update({ speakerDeviceId: e.target.value })} style={selectStyle}>
            <option value="default">Default speaker</option>
            {speakers.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0, 8)}`}</option>)}
          </select>
          {speakers.length === 0 && (
            <p style={{ margin: "6px 0 0", fontSize: "12px", color: C.t3 }}>
              Click "Test Mic" above to grant microphone permission and reveal device labels.
            </p>
          )}
        </FieldGroup>
      </Section>

      <Section title="Camera">
        <FieldGroup label="Video Device">
          <select value={settings.cameraDeviceId} onChange={(e) => update({ cameraDeviceId: e.target.value })} style={selectStyle}>
            <option value="default">Default camera</option>
            {cameras.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 8)}`}</option>)}
          </select>
        </FieldGroup>
      </Section>
    </div>
  );
}

// ─── Notifications tab ───────────────────────────────────────
function NotificationsTab() {
  const { settings, update } = useSettings();
  const [permState, setPermState] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) setPermState(Notification.permission);
  }, []);

  async function requestPermission() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermState(result);
    if (result === "granted") update({ desktopNotifications: true });
  }

  return (
    <Section title="Notifications">
      <FieldGroup label="Desktop Notifications">
        {permState === "denied" ? (
          <div style={{
            padding: "12px 14px", borderRadius: "10px",
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#fca5a5" }}>
              Notifications are blocked by your browser. Open browser settings to allow them for this site.
            </p>
          </div>
        ) : permState === "granted" ? (
          <Toggle
            label="Enable desktop notifications"
            checked={settings.desktopNotifications}
            onChange={(v) => update({ desktopNotifications: v })}
            description="Show a desktop notification for new messages"
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={requestPermission} style={btnGrad}>Enable Notifications</button>
            <p style={{ margin: 0, fontSize: "12px", color: C.t3 }}>
              You'll be asked for permission by your browser.
            </p>
          </div>
        )}
      </FieldGroup>

      <FieldGroup label="Sounds">
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <Toggle label="Message sounds"   checked={settings.messageSound} onChange={(v) => update({ messageSound: v })} description="Play a sound when a new message arrives" />
          <Toggle label="Mention sounds"   checked={settings.mentionSound} onChange={(v) => update({ mentionSound: v })} description="Play a distinct sound when you're mentioned" />
        </div>
      </FieldGroup>
    </Section>
  );
}

// ─── Appearance tab ──────────────────────────────────────────
function AppearanceTab() {
  const { settings, update } = useSettings();

  return (
    <Section title="Appearance">
      <FieldGroup label="Message Display">
        <div style={{ display: "flex", gap: "10px" }}>
          {(["comfortable", "compact"] as const).map((d) => (
            <button
              key={d}
              onClick={() => update({ messageDensity: d })}
              style={{
                flex: 1, padding: "12px", borderRadius: "10px", cursor: "pointer",
                border: settings.messageDensity === d ? `1px solid rgba(66,219,188,0.6)` : `1px solid ${C.border}`,
                background: settings.messageDensity === d ? "rgba(66,219,188,0.1)" : "rgba(255,255,255,0.03)",
                color: settings.messageDensity === d ? C.teal : C.t2,
                textAlign: "left", transition: "all 0.15s",
              }}
            >
              <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "13px", color: "inherit" }}>
                {d === "comfortable" ? "Comfortable" : "Compact"}
              </p>
              <p style={{ margin: 0, fontSize: "11px", color: C.t3 }}>
                {d === "comfortable" ? "More spacing between messages" : "Denser layout, more messages visible"}
              </p>
            </button>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup label={`Font Size — ${settings.fontSize}px`}>
        <input
          type="range" min={12} max={18} step={1}
          value={settings.fontSize}
          onChange={(e) => update({ fontSize: Number(e.target.value) })}
          style={{ width: "100%", accentColor: C.teal }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
          <span style={{ fontSize: "11px", color: C.t3 }}>12px</span>
          <span style={{ fontSize: "11px", color: C.t3 }}>18px</span>
        </div>
        <div style={{
          marginTop: "12px", padding: "12px 14px", background: "rgba(255,255,255,0.04)",
          borderRadius: "8px", border: `1px solid ${C.border}`,
        }}>
          <p style={{ margin: 0, fontSize: `${settings.fontSize}px`, color: C.t2, lineHeight: 1.55 }}>
            Preview: This is how your message text will look.
          </p>
        </div>
      </FieldGroup>
    </Section>
  );
}

// ─── Board Trash tab ─────────────────────────────────────────
type DeletedBoard = {
  id: string; name: string; type: "KANBAN" | "TABLE"; deletedAt: string; createdById: string;
};

function TrashTab({ serverId }: { serverId: string }) {
  const { data: session } = useSession();
  const [boards, setBoards] = useState<DeletedBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => { load(); }, [serverId]);

  async function load() {
    setLoading(true);
    const res = await fetch(`${getApiUrl()}/servers/${serverId}/boards/trash`, { credentials: "include" });
    const d = res.ok ? await res.json() : [];
    setBoards(Array.isArray(d) ? d : []);
    setLoading(false);
  }

  async function restore(boardId: string) {
    setBusy(boardId);
    const res = await fetch(`${getApiUrl()}/boards/${boardId}/restore`, { method: "POST", credentials: "include" });
    setBusy(null);
    if (res.ok) {
      setBoards((prev) => prev.filter((b) => b.id !== boardId));
      showToast("Board restored");
    }
  }

  async function deletePermanent(boardId: string, name: string) {
    if (!window.confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
    setBusy(boardId);
    await fetch(`${getApiUrl()}/boards/${boardId}/permanent`, { method: "DELETE", credentials: "include" });
    setBusy(null);
    setBoards((prev) => prev.filter((b) => b.id !== boardId));
    showToast("Board permanently deleted");
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  function daysLeft(deletedAt: string) {
    const d = new Date(deletedAt);
    const exp = new Date(d.getTime() + 30 * 24 * 60 * 60 * 1000);
    return Math.max(0, Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  return (
    <Section title="Board Trash">
      {toast && (
        <div style={{
          position: "fixed", top: "20px", right: "20px", zIndex: 9999,
          background: "rgba(16,185,129,0.9)", color: "#fff",
          padding: "10px 18px", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
          animation: "fadeIn 0.2s ease",
        }}>
          {toast}
        </div>
      )}

      <div style={{
        padding: "12px 14px", marginBottom: "20px", borderRadius: "10px",
        background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", gap: "10px",
      }}>
        <span style={{ fontSize: "16px" }}>ℹ️</span>
        <p style={{ margin: 0, fontSize: "12px", color: C.t3, lineHeight: 1.6 }}>
          Deleted boards are kept for <strong style={{ color: C.t2 }}>30 days</strong> before being permanently removed.
          Restore them any time within that window.
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[0, 1].map((i) => (
            <div key={i} style={{
              height: "64px", borderRadius: "10px",
              background: C.card, border: `1px solid ${C.border}`,
              animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite`,
            }} />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ fontSize: "32px", margin: "0 0 8px" }}>🗑️</p>
          <p style={{ margin: 0, fontSize: "14px", color: C.t3 }}>Board trash is empty</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {boards.map((board) => {
            const days = daysLeft(board.deletedAt);
            const urgent = days <= 3;
            return (
              <div key={board.id} style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "12px 14px", borderRadius: "10px",
                background: C.card, border: `1px solid ${C.border}`,
                opacity: busy === board.id ? 0.6 : 1,
              }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "9px", flexShrink: 0,
                  background: board.type === "KANBAN" ? "rgba(66,219,188,0.1)" : "rgba(33,87,154,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px",
                }}>
                  {board.type === "KANBAN" ? "⊞" : "☰"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: C.t1 }}>{board.name}</p>
                  <p style={{ margin: 0, fontSize: "11px", color: urgent ? "#fca5a5" : C.t3 }}>
                    {board.type} · {urgent
                      ? `⚠️ ${days} day${days !== 1 ? "s" : ""} left`
                      : `Deleted ${new Date(board.deletedAt).toLocaleDateString()} · ${days} days left`}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <button
                    onClick={() => restore(board.id)}
                    disabled={!!busy}
                    style={{ ...btnGrad, fontSize: "12px", padding: "6px 12px" }}
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => deletePermanent(board.id, board.name)}
                    disabled={!!busy}
                    style={{
                      padding: "6px 12px", fontSize: "12px", fontWeight: 600,
                      color: C.red, background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px",
                      cursor: "pointer", transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
                  >
                    Delete Forever
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} } @keyframes fadeIn { from{opacity:0} to{opacity:1} }`}</style>
    </Section>
  );
}

// ─── Shortcuts tab ───────────────────────────────────────────
const SHORTCUTS = [
  { group: "Navigation",  items: [
    { key: "Ctrl + K",       desc: "Quick switcher" },
    { key: "Alt + ↑ / ↓",   desc: "Navigate channels" },
    { key: "Ctrl + /",       desc: "Show shortcuts" },
  ]},
  { group: "Messaging",   items: [
    { key: "Enter",          desc: "Send message" },
    { key: "↑",              desc: "Edit last message" },
    { key: "Esc",            desc: "Cancel edit" },
    { key: "Ctrl + Enter",   desc: "New line in message" },
  ]},
  { group: "Voice & Video", items: [
    { key: "M",              desc: "Toggle mute" },
    { key: "D",              desc: "Toggle deafen" },
  ]},
];

function ShortcutsTab() {
  return (
    <Section title="Keyboard Shortcuts">
      {SHORTCUTS.map(({ group, items }) => (
        <div key={group} style={{ marginBottom: "24px" }}>
          <p style={{ margin: "0 0 10px", fontSize: "11px", fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {group}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {items.map(({ key, desc }) => (
              <div key={key} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px", borderRadius: "8px",
                background: "rgba(255,255,255,0.03)",
              }}>
                <span style={{ fontSize: "13px", color: C.t2 }}>{desc}</span>
                <kbd style={{
                  padding: "3px 8px", borderRadius: "6px",
                  background: C.card, border: `1px solid ${C.border}`,
                  fontSize: "11px", fontWeight: 600, color: C.teal,
                  fontFamily: "ui-monospace, monospace",
                }}>
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Section>
  );
}

// ─── Main modal ──────────────────────────────────────────────
export function SettingsModal({
  onClose, serverId,
}: {
  onClose: () => void; serverId: string;
}) {
  const [tab, setTab] = useState<Tab>("account");

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
        animation: "fadeIn 0.15s ease",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(820px, 100%)", height: "min(600px, 90vh)",
          display: "flex", borderRadius: "16px", overflow: "hidden",
          background: C.bg, border: `1px solid ${C.border}`,
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
          animation: "slideUp 0.2s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Left nav */}
        <div style={{
          width: "200px", flexShrink: 0, background: C.panel,
          borderRight: `1px solid ${C.border}`,
          display: "flex", flexDirection: "column",
          padding: "16px 8px",
        }}>
          <p style={{
            margin: "0 8px 12px", fontSize: "11px", fontWeight: 700, color: C.t3,
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            Settings
          </p>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: "9px",
                padding: "8px 10px", borderRadius: "8px", width: "100%",
                border: "none", cursor: "pointer", textAlign: "left",
                fontSize: "13px", fontWeight: tab === t.id ? 600 : 400,
                color: tab === t.id ? C.t1 : C.t2,
                background: tab === t.id ? "rgba(66,219,188,0.12)" : "transparent",
                transition: "background 0.12s, color 0.12s",
              }}
              onMouseEnter={(e) => { if (tab !== t.id) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = C.t1; } }}
              onMouseLeave={(e) => { if (tab !== t.id) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.t2; } }}
            >
              <span style={{ fontSize: "14px" }}>{t.icon}</span>
              {t.label}
            </button>
          ))}

          {/* Spacer + close */}
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              display: "flex", alignItems: "center", gap: "9px",
              padding: "8px 10px", borderRadius: "8px", width: "100%",
              border: "none", cursor: "pointer", textAlign: "left",
              fontSize: "13px", color: C.t3, background: "transparent",
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = C.red; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.t3; }}
          >
            <span style={{ fontSize: "14px" }}>✕</span>
            Close
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "24px 28px",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}>
          {tab === "account"       && <AccountTab />}
          {tab === "voice"         && <VoiceTab />}
          {tab === "notifications" && <NotificationsTab />}
          {tab === "appearance"    && <AppearanceTab />}
          {tab === "trash"         && <TrashTab serverId={serverId} />}
          {tab === "shortcuts"     && <ShortcutsTab />}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(16px) scale(0.98)} to{opacity:1;transform:none} }
        select option { background: #111d2e; }
        input[type=range]::-webkit-slider-thumb { background: #42DBBC; }
      `}</style>
    </div>
  );
}

// ─── Shared sub-components ───────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "32px" }}>
      <h2 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 800, color: C.t1, letterSpacing: "-0.02em" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "8px" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange, description }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; description?: string;
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", userSelect: "none" }}
    >
      <div style={{
        width: "40px", height: "22px", borderRadius: "100px", flexShrink: 0,
        background: checked ? C.teal : "rgba(255,255,255,0.1)",
        position: "relative", transition: "background 0.2s",
      }}>
        <div style={{
          position: "absolute", top: "3px",
          left: checked ? "21px" : "3px",
          width: "16px", height: "16px", borderRadius: "50%",
          background: "#fff", transition: "left 0.2s",
        }} />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 500, color: C.t1 }}>{label}</p>
        {description && <p style={{ margin: 0, fontSize: "11px", color: C.t3 }}>{description}</p>}
      </div>
    </div>
  );
}

// Shared input / button / select styles
const inputStyle: React.CSSProperties = {
  flex: 1, padding: "9px 12px", fontSize: "14px", color: C.t1,
  background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`,
  borderRadius: "8px", outline: "none", width: "100%",
};

const btnGrad: React.CSSProperties = {
  padding: "8px 18px", borderRadius: "8px", border: "none",
  background: C.grad, color: "#fff",
  fontSize: "13px", fontWeight: 700, cursor: "pointer",
  boxShadow: "0 2px 12px rgba(66,219,188,0.3)",
};

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", fontSize: "14px", color: C.t1,
  background: C.card, border: `1px solid ${C.border}`,
  borderRadius: "8px", outline: "none",
};
