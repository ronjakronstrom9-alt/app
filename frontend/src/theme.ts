import { Platform } from "react-native";

export const colors = {
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
};

export const fonts = {
  display: Platform.select({ ios: "Times New Roman", android: "serif", default: "serif" })!,
  body: Platform.select({ ios: "Helvetica", android: "sans-serif", default: "System" })!,
};

export const radii = { sm: 8, md: 16, lg: 20, xl: 28, pill: 999 };
export const space = (n: number) => n * 8;
