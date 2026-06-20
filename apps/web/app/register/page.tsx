"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Star = {
  x: number;
  y: number;
  radius: number;
  baseOpacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
};

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const router = useRouter();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    function resize() {
      const parent = canvas!.parentElement!;
      canvas!.width = parent.clientWidth;
      canvas!.height = parent.clientHeight;

      starsRef.current = Array.from({ length: 110 }, () => ({
        x: Math.random() * canvas!.width,
        y: Math.random() * canvas!.height,
        radius: Math.random() * 1.4 + 0.3,
        baseOpacity: Math.random() * 0.5 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
      }));
    }
    resize();
    window.addEventListener("resize", resize);

    let animationFrame: number;
    let t = 0;

    function draw() {
      t += 1;
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);

      for (const star of starsRef.current) {
        const twinkle = Math.sin(t * star.twinkleSpeed + star.twinklePhase) * 0.4 + 0.6;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.baseOpacity * twinkle})`;
        ctx.fill();
      }

      animationFrame = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to register");
        setLoading(false);
        return;
      }

      router.push("/login");
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "12px 14px",
    borderRadius: "10px",
    border: focused ? "1.5px solid #1a9e8f" : "1.5px solid #e5e7eb",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    boxShadow: focused ? "0 0 0 4px rgba(26,158,143,0.12)" : "none",
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        fontFamily: "'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          animation: "fadeSlideIn 0.6s ease",
        }}
      >
        <div style={{ width: "100%", maxWidth: "360px" }}>
          <div
            style={{
              width: "44px",
              height: "4px",
              borderRadius: "2px",
              background: "linear-gradient(135deg, #1d4f8f 0%, #1a9e8f 100%)",
              marginBottom: "20px",
            }}
          />
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "#0d1f3c",
              margin: "0 0 6px",
              letterSpacing: "-0.02em",
            }}
          >
            Create your account
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#6b7280",
              margin: "0 0 32px",
            }}
          >
            Start building with your team
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: "6px",
                }}
              >
                Full name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                required
                placeholder="Your name"
                style={inputStyle(nameFocused)}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: "6px",
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                required
                placeholder="you@example.com"
                style={inputStyle(emailFocused)}
              />
            </div>

            <div style={{ marginBottom: "10px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: "6px",
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                required
                minLength={8}
                placeholder="At least 8 characters"
                style={inputStyle(passwordFocused)}
              />
            </div>

            {error && (
              <p
                style={{
                  background: "#fef2f2",
                  color: "#dc2626",
                  fontSize: "13px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  marginTop: "14px",
                  marginBottom: "0",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: "10px",
                border: "none",
                background: "linear-gradient(135deg, #1d4f8f 0%, #1a9e8f 100%)",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                marginTop: "24px",
                boxShadow: "0 4px 14px rgba(26,158,143,0.3)",
                transition: "transform 0.1s ease, box-shadow 0.15s ease",
              }}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p
            style={{
              fontSize: "13px",
              color: "#6b7280",
              marginTop: "28px",
              textAlign: "center",
            }}
          >
            Already have an account?{" "}
            <a href="/login" style={{ color: "#1a9e8f", fontWeight: 600, textDecoration: "none" }}>
              Sign in
            </a>
          </p>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          position: "relative",
          background: "linear-gradient(135deg, #0d1f3c 0%, #163a5e 50%, #0f4d4a 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          overflow: "hidden",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: "-80px",
            left: "-80px",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(45,212,191,0.2) 0%, transparent 70%)",
            animation: "float1 8s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-100px",
            right: "-60px",
            width: "360px",
            height: "360px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(29,79,143,0.3) 0%, transparent 70%)",
            animation: "float2 10s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            textAlign: "center",
            animation: "fadeUp 0.8s ease",
          }}
        >
          <div
            style={{
              position: "relative",
              display: "inline-block",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "380px",
                height: "260px",
                background: "radial-gradient(ellipse, rgba(255,255,255,0.18) 0%, transparent 65%)",
                pointerEvents: "none",
              }}
            />
            <Image
              src="/jezsync-logo.png"
              alt="Jez Sync"
              width={340}
              height={191}
              style={{
                objectFit: "contain",
                position: "relative",
                filter:
                  "drop-shadow(0 4px 24px rgba(0,0,0,0.5)) brightness(1.15) contrast(1.05)",
              }}
              priority
            />
          </div>
          <p
            style={{
              color: "#e2e8f0",
              fontSize: "16px",
              maxWidth: "320px",
              margin: "0 auto",
              lineHeight: "1.6",
            }}
          >
            Voice, video, and project management - all in one place.
          </p>

          <div
            style={{
              display: "flex",
              gap: "8px",
              justifyContent: "center",
              marginTop: "28px",
            }}
          >
            {["Chat", "Voice", "Boards"].map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: "12px",
                  color: "#cbd5e1",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "20px",
                  padding: "5px 14px",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <style>{`
          @keyframes float1 {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(30px, 40px); }
          }
          @keyframes float2 {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(-40px, -30px); }
          }
          @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateX(-12px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(16px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </main>
  );
}