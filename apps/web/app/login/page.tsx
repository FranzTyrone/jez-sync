"use client";

import { useState, useRef, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const CELL = 40;
type Ripple = { cx: number; cy: number; t: number; speed: number; maxR: number };

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const t = {
    panelBg:      darkMode ? "#0f172a" : "#ffffff",
    heading:      darkMode ? "#f1f5f9" : "#0f172a",
    subtitle:     darkMode ? "#64748b" : "#94a3b8",
    label:        darkMode ? "#94a3b8" : "#374151",
    inputBg:      darkMode ? "#1e293b" : "#f9fafb",
    inputBgFocus: darkMode ? "#162032" : "#f8fffe",
    inputBorder:  darkMode ? "#334155" : "#e5e7eb",
    inputText:    darkMode ? "#e2e8f0" : "#111827",
    dividerLine:  darkMode ? "#1e293b" : "#f1f5f9",
    dividerText:  darkMode ? "#475569" : "#cbd5e1",
    linkBorder:   darkMode ? "#334155" : "#e5e7eb",
    linkText:     darkMode ? "#94a3b8" : "#374151",
    linkBgHover:  darkMode ? "#1e293b" : "#f0fdfb",
    footerText:   darkMode ? "#475569" : "#cbd5e1",
    termsText:    darkMode ? "#64748b" : "#94a3b8",
    toggleBg:     darkMode ? "#1e293b" : "#f1f5f9",
    toggleColor:  darkMode ? "#94a3b8" : "#64748b",
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const panel = panelRef.current;
    if (!canvas || !panel) return;
    const ctx = canvas.getContext("2d")!;
    let cols = 0, rows = 0;
    let brightness: Float32Array;
    let decay: Float32Array;
    let ripples: Ripple[] = [];
    let raf: number;
    let frame = 0;

    function init() {
      const w = panel!.clientWidth;
      const h = panel!.clientHeight;
      canvas!.width = w;
      canvas!.height = h;
      cols = Math.ceil(w / CELL) + 2;
      rows = Math.ceil(h / CELL) + 2;
      const n = cols * rows;
      brightness = new Float32Array(n);
      decay = new Float32Array(n).map(() => 0.014 + Math.random() * 0.012);
    }

    function spawn() {
      ripples.push({
        cx: Math.floor(Math.random() * cols),
        cy: Math.floor(Math.random() * rows),
        t: 0,
        speed: 0.16 + Math.random() * 0.12,
        maxR: 7 + Math.random() * 11,
      });
    }

    function draw() {
      frame++;
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      if (frame % 42 === 0) spawn();
      if (frame % 90 === 0) spawn();

      ripples = ripples.filter((r) => r.t * r.speed < r.maxR + 4);
      for (const r of ripples) {
        r.t++;
        const radius = r.t * r.speed;
        const minC = Math.max(0, Math.floor(r.cx - radius - 2));
        const maxC = Math.min(cols - 1, Math.ceil(r.cx + radius + 2));
        const minR2 = Math.max(0, Math.floor(r.cy - radius - 2));
        const maxR2 = Math.min(rows - 1, Math.ceil(r.cy + radius + 2));
        for (let row = minR2; row <= maxR2; row++) {
          for (let col = minC; col <= maxC; col++) {
            const dist = Math.sqrt((col - r.cx) ** 2 + (row - r.cy) ** 2);
            const wave = Math.exp(-((dist - radius) ** 2) * 1.8);
            if (wave > 0.04) {
              const idx = row * cols + col;
              brightness[idx] = Math.min(1, (brightness[idx] ?? 0) + wave * 0.85);
            }
          }
        }
      }

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const idx = row * cols + col;
          const b = brightness[idx] ?? 0;
          const x = col * CELL;
          const y = row * CELL;
          if (b > 0.004) {
            ctx.fillStyle = `rgba(66,219,188,${b * 0.14})`;
            ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
          }
          ctx.strokeStyle = `rgba(66,219,188,${0.045 + b * 0.5})`;
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
          brightness[idx] = Math.max(0, b - (decay[idx] ?? 0));
        }
      }
      raf = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(init);
    ro.observe(panel);
    init();
    for (let i = 0; i < 5; i++) spawn();
    draw();
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/");
    }
  }

  const inputStyle = (name: string): React.CSSProperties => ({
    width: "100%",
    padding: "12px 16px",
    backgroundColor: focused === name ? t.inputBgFocus : t.inputBg,
    border: focused === name ? "1.5px solid #42DBBC" : `1.5px solid ${t.inputBorder}`,
    borderRadius: "10px",
    fontSize: "14px",
    color: t.inputText,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.18s, background-color 0.18s, box-shadow 0.18s",
    boxShadow: focused === name ? "0 0 0 4px rgba(66,219,188,0.15)" : "none",
  });

  const features = [
    { icon: "💬", label: "Real-time Chat", desc: "Channels, threads & direct messages" },
    { icon: "🎙️", label: "Voice & Video", desc: "Crystal-clear calls with your team" },
    { icon: "📋", label: "Project Boards", desc: "Kanban boards & task management" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ── Left branding panel ── */}
      <div
        ref={panelRef}
        style={{
          flex: "0 0 48%",
          position: "relative",
          background: "linear-gradient(160deg, #040d1a 0%, #0a1f3c 55%, #061628 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem 3.5rem",
          overflow: "hidden",
        }}
        className="branding-panel"
      >
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        />
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "220px",
          background: "linear-gradient(to top, rgba(66,219,188,0.08), transparent)",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "380px" }}>
          <h2 style={{
            fontSize: "32px", fontWeight: 800, color: "#ffffff",
            margin: "0 0 14px", lineHeight: 1.2, letterSpacing: "-0.03em",
          }}>
            Everything your<br />
            <span style={{
              background: "linear-gradient(90deg, #42DBBC, #7dd3fc)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>team needs</span>, in one place.
          </h2>
          <p style={{ fontSize: "14px", color: "#94a3b8", margin: "0 0 40px", lineHeight: 1.6 }}>
            Voice, video, chat, and project management — built for teams that move fast.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {features.map((f) => (
              <div key={f.label} style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "10px", flexShrink: 0,
                  background: "rgba(66,219,188,0.1)", border: "1px solid rgba(66,219,188,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px",
                }}>
                  {f.icon}
                </div>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0", marginBottom: "2px" }}>{f.label}</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: "48px", display: "inline-flex", alignItems: "center", gap: "8px",
            background: "rgba(66,219,188,0.08)", border: "1px solid rgba(66,219,188,0.18)",
            borderRadius: "100px", padding: "6px 14px",
          }}>
            <div style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#42DBBC", animation: "pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: "11px", color: "#42DBBC", fontWeight: 600, letterSpacing: "0.05em" }}>ALL SYSTEMS OPERATIONAL</span>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: t.panelBg, padding: "3rem 2rem", position: "relative",
        transition: "background-color 0.25s ease",
      }}>
        <div style={{
          position: "absolute", top: 0, right: 0, width: "300px", height: "300px",
          background: "radial-gradient(circle, rgba(66,219,188,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Dark mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          style={{
            position: "absolute", top: "20px", right: "20px",
            width: "38px", height: "38px", borderRadius: "10px",
            background: t.toggleBg, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: t.toggleColor, transition: "background-color 0.2s, color 0.2s",
          }}
        >
          {darkMode ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        <div style={{ width: "100%", maxWidth: "380px", position: "relative" }}>

          {/* Header */}
          <div style={{ marginBottom: "36px" }}>
            <div style={{ marginBottom: "20px", display: "flex", justifyContent: "center" }}>
              <Image
                src="/jezsync-logo.png"
                alt="Jez Sync"
                width={220}
                height={124}
                style={{ objectFit: "contain" }}
                priority
              />
            </div>
            <h1 style={{
              fontSize: "26px", fontWeight: 800, color: t.heading,
              margin: "0 0 6px", letterSpacing: "-0.03em", textAlign: "center",
              transition: "color 0.25s ease",
            }}>
              Welcome back
            </h1>
            <p style={{ fontSize: "14px", color: t.subtitle, margin: "0 0 8px", textAlign: "center", transition: "color 0.25s ease" }}>
              Sign in to your workspace to continue
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: t.label, marginBottom: "7px", transition: "color 0.25s ease" }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                required
                placeholder="you@example.com"
                style={inputStyle("email")}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: t.label, marginBottom: "7px", transition: "color 0.25s ease" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  required
                  placeholder="••••••••"
                  style={{ ...inputStyle("password"), paddingRight: "46px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  style={{
                    position: "absolute", right: "14px", top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    padding: "2px", color: "#9ca3af", display: "flex", alignItems: "center",
                  }}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                display: "flex", alignItems: "center", gap: "9px",
                backgroundColor: "#fef2f2", border: "1px solid #fecaca",
                color: "#dc2626", fontSize: "13px",
                padding: "11px 14px", borderRadius: "10px",
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "13px",
                borderRadius: "10px", border: "none",
                background: loading ? "#a5d8d0" : "linear-gradient(135deg, #42DBBC 0%, #21579A 100%)",
                color: "#fff", fontSize: "14px", fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                marginTop: "4px",
                boxShadow: loading ? "none" : "0 4px 20px rgba(66,219,188,0.35)",
                transition: "transform 0.12s ease, box-shadow 0.15s ease",
                letterSpacing: "0.02em",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 28px rgba(66,219,188,0.45)";
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(66,219,188,0.35)";
              }}
            >
              {loading ? "Signing in…" : "Sign in →"}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", margin: "28px 0" }}>
            <div style={{ flex: 1, height: "1px", backgroundColor: t.dividerLine, transition: "background-color 0.25s ease" }} />
            <span style={{ fontSize: "12px", color: t.dividerText, whiteSpace: "nowrap", transition: "color 0.25s ease" }}>Don't have an account?</span>
            <div style={{ flex: 1, height: "1px", backgroundColor: t.dividerLine, transition: "background-color 0.25s ease" }} />
          </div>

          <a
            href="/register"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              padding: "12px", borderRadius: "10px",
              border: `1.5px solid ${t.linkBorder}`,
              color: t.linkText, fontSize: "14px", fontWeight: 600,
              textDecoration: "none",
              transition: "border-color 0.18s, color 0.18s, background-color 0.18s",
              backgroundColor: "transparent",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.borderColor = "#42DBBC";
              el.style.color = "#21579A";
              el.style.backgroundColor = t.linkBgHover;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.borderColor = t.linkBorder;
              el.style.color = t.linkText;
              el.style.backgroundColor = "transparent";
            }}
          >
            Create a free account
          </a>

          <p style={{ fontSize: "11px", color: t.footerText, textAlign: "center", marginTop: "24px", lineHeight: 1.6, transition: "color 0.25s ease" }}>
            By signing in, you agree to our{" "}
            <span style={{ color: t.termsText, cursor: "pointer" }}>Terms</span>
            {" "}and{" "}
            <span style={{ color: t.termsText, cursor: "pointer" }}>Privacy Policy</span>.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        .branding-panel { animation: fadeIn 0.6s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        input::placeholder { color: #d1d5db; }
        input:-webkit-autofill,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #f9fafb inset !important;
          -webkit-text-fill-color: #111827 !important;
          caret-color: #111827;
        }
        @media (max-width: 768px) {
          .branding-panel { display: none !important; }
        }
      `}</style>
    </div>
  );
}
