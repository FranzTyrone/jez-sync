"use client";

import { createContext, useContext, useEffect, useState } from "react";

type ThemeCtx = { dark: boolean; toggle: () => void };
const ThemeContext = createContext<ThemeCtx>({ dark: true, toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("jez-theme");
    if (saved === "light") setDark(false);
  }, []);

  function toggle() {
    setDark((d) => {
      localStorage.setItem("jez-theme", d ? "light" : "dark");
      return !d;
    });
  }

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

export function themeColors(dark: boolean) {
  return dark
    ? {
        rail:       "#060c17",
        side:       "#0c1628",
        main:       "#0d1524",
        card:       "#111d2e",
        cardAlt:    "#0d1524",
        border:     "rgba(255,255,255,0.07)",
        borderSoft: "#1e2d42",
        t1:         "#f1f5f9",
        t2:         "#94a3b8",
        t3:         "#475569",
        t4:         "#2d3d52",
        inputBg:    "#0d1524",
        inputBorder:"#252f42",
        hover:      "rgba(255,255,255,0.05)",
        rowHover:   "#0d1a2a",
        teal:       "#42DBBC",
        blue:       "#21579A",
        grad:       "linear-gradient(135deg, #42DBBC 0%, #21579A 100%)",
        green:      "#10b981",
        red:        "#ef4444",
        scrollbar:  "#1e2d42",
      }
    : {
        rail:       "#e8edf5",
        side:       "#ffffff",
        main:       "#f4f6fa",
        card:       "#ffffff",
        cardAlt:    "#f8fafc",
        border:     "rgba(0,0,0,0.08)",
        borderSoft: "#e2e8f0",
        t1:         "#0f172a",
        t2:         "#475569",
        t3:         "#94a3b8",
        t4:         "#cbd5e1",
        inputBg:    "#f8fafc",
        inputBorder:"#e2e8f0",
        hover:      "rgba(0,0,0,0.04)",
        rowHover:   "#f1f5f9",
        teal:       "#0ea5a0",
        blue:       "#21579A",
        grad:       "linear-gradient(135deg, #0ea5a0 0%, #21579A 100%)",
        green:      "#059669",
        red:        "#dc2626",
        scrollbar:  "#e2e8f0",
      };
}
