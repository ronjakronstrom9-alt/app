import { Platform, TextStyle } from "react-native";

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

// Font families (loaded by useAppFonts). Fall back to system serif if a load
// race ever surfaces — keeps things readable rather than tofu.
export const fonts = {
  display: "Cinzel",
  displayFallback: Platform.select({ ios: "Times New Roman", android: "serif", default: "serif" })!,
  serif: "CormorantGaramond",
  serifItalic: "CormorantGaramond-Italic",
  body: "Inter",
  bodyItalic: "Inter-Italic",
};

// =====================================================================
// Typography hierarchy — apply consistently across the app.
//
//  display1   The brand mark / hero screen titles (32–40+)  Cinzel
//  display2   Card titles in lesson intro & detail (28–36)  Cinzel
//  h1         Tab screen titles (26–30)                     Cinzel
//  h2         Section headings inside lessons / cards (22)  Cormorant
//  h3         Card name on small thumbnails (14–16)         Cinzel
//  kicker     ALL-CAPS labels above titles (11–12)          Cinzel
//  subtitle   Italic mystical subtitles (14–16)             CormorantGaramond-Italic
//  body       Long-form lesson copy, descriptions           system sans-serif
//  bodyLg     Same but slightly larger for question prompts system sans-serif
//  meta       Tiny meta labels under cards (10–11)          system sans-serif
//  button     CTA labels                                    system sans-serif
// =====================================================================

export const type: Record<string, TextStyle> = {
  display1: {
    fontFamily: fonts.display,
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: 4,
    color: colors.gold,
  },
  display2: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 2,
    color: colors.gold,
  },
  h1: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 2,
    color: colors.textPrimary,
  },
  h2: {
    fontFamily: fonts.serif,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 0.5,
    color: colors.textPrimary,
  },
  h3: {
    fontFamily: fonts.display,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 2.5,
    color: colors.textPrimary,
  },
  kicker: {
    fontFamily: fonts.display,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: colors.gold,
  },
  subtitle: {
    fontFamily: fonts.serifItalic,
    fontStyle: "italic",
    fontSize: 16,
    lineHeight: 22,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  bodyLg: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 26,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  button: {
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
};

export const radii = { sm: 8, md: 16, lg: 20, xl: 28, pill: 999 };
export const space = (n: number) => n * 8;
