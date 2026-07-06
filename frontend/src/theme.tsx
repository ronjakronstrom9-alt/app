import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { storage } from "@/src/utils/storage";
import { Platform, TextStyle } from "react-native";

// ============ PALETTES ============
const dark = {
  bg: "#0B081A",
  bg2: "#110A2E",
  surface: "#1A103C",
  surface2: "#24184E",
  textPrimary: "#F5F5F0",
  textSecondary: "#AFA5CA",
  textMuted: "#7A6F95",
  gold: "#D4AF37",
  goldGlow: "#F2CD5C",
  violet: "#4A3B69",
  crimson: "#E84855",
  green: "#4ADE80",
  border: "rgba(212, 175, 55, 0.25)",
  borderSoft: "rgba(212, 175, 55, 0.12)",
  overlayGrad: "rgba(11, 8, 26, 0.92)",
};

const light = {
  bg: "#F5F1E8",
  bg2: "#EDE6D3",
  surface: "#FFFFFF",
  surface2: "#F8F3E4",
  textPrimary: "#1B1428",
  textSecondary: "#5A4E70",
  textMuted: "#8A7F9A",
  gold: "#B08D2E",
  goldGlow: "#D4AF37",
  violet: "#7A6893",
  crimson: "#C43C4B",
  green: "#22A957",
  border: "rgba(176, 141, 46, 0.35)",
  borderSoft: "rgba(176, 141, 46, 0.18)",
  overlayGrad: "rgba(27, 20, 40, 0.85)",
};

// Static defaults exported for backwards compat. Legacy imports (`colors`)
// still work; new code should use `useTheme()` for reactive theming.
export let colors = dark;

export const fonts = {
  display: "Cinzel",
  displayFallback: Platform.select({ ios: "Times New Roman", android: "serif", default: "serif" })!,
  serif: "CormorantGaramond",
  serifItalic: "CormorantGaramond-Italic",
  body: "Inter",
  bodyItalic: "Inter-Italic",
};

export const radii = { sm: 8, md: 16, lg: 20, xl: 28, pill: 999 };
export const space = (n: number) => n * 8;

// ============ REACTIVE THEME CONTEXT ============
type ThemeMode = "dark" | "light";
type ThemeCtx = {
  mode: ThemeMode;
  colors: typeof dark;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
};

const Ctx = createContext<ThemeCtx | null>(null);
const THEME_KEY = "mt_theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>(THEME_KEY, "");
      if (saved === "light" || saved === "dark") setModeState(saved);
    })();
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    storage.setItem(THEME_KEY, m);
    colors = m === "dark" ? dark : light; // update legacy export
  };

  const toggle = () => setMode(mode === "dark" ? "light" : "dark");

  const value = useMemo<ThemeCtx>(() => {
    const c = mode === "dark" ? dark : light;
    colors = c; // keep legacy sync
    return { mode, colors: c, setMode, toggle };
  }, [mode]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) return { mode: "dark", colors: dark, setMode: () => {}, toggle: () => {} };
  return ctx;
}

// Typography tokens (reference the LEGACY colors export so style objects stay
// stable across re-renders — colors mutate in place on theme switch).
export const type: Record<string, TextStyle> = {
  display1: { fontFamily: fonts.display, fontSize: 38, lineHeight: 46, letterSpacing: 4 },
  display2: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40, letterSpacing: 2 },
  h1: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: 2 },
  h2: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 30, letterSpacing: 0.5 },
  h3: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20, letterSpacing: 2.5 },
  kicker: { fontFamily: fonts.display, fontSize: 11, letterSpacing: 3, textTransform: "uppercase" },
  subtitle: { fontFamily: fonts.serifItalic, fontStyle: "italic", fontSize: 16, lineHeight: 22, letterSpacing: 0.3 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 24, letterSpacing: 0.2 },
  bodyLg: { fontFamily: fonts.body, fontSize: 17, lineHeight: 26, letterSpacing: 0.2 },
  meta: { fontFamily: fonts.body, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" },
  button: { fontFamily: fonts.body, fontSize: 16, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
};
