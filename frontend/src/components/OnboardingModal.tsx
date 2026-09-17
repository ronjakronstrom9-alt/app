import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts } from "@/src/theme";
import { storage } from "@/src/utils/storage";
import { StarBg } from "@/src/components/StarBg";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/auth";

const KEY = "mt_onboarding_v2";

// The first slide is the interactive mode picker (rendered separately,
// below); everything after it is a plain content slide.
const SLIDES = [
  {
    icon: "moon",
    title: "Welcome to Mystic XP",
    body: "Tarot is a symbolic language for reflection — 78 archetypal images that mirror the human journey. This app teaches you to read them.",
  },
  {
    icon: "star",
    title: "XP & Levels",
    body: "Finishing lessons and quizzes earns you XP. As your XP grows you level up and gain a new title, from Seeker all the way to Arcanum — track it on your home screen and profile.",
  },
  {
    icon: "heart",
    title: "Hearts",
    body: "Hearts are your practice lives, shown at the top of your home screen. If you ever run out, you can refill them from your profile and keep going.",
  },
  {
    icon: "flame",
    title: "Streaks & Your Path",
    body: "Practice on consecutive days to build your streak. Your Path unlocks one card at a time — finish the current lesson to open the next; locked cards show a small lock icon until then.",
  },
  {
    icon: "sunny",
    title: "Upright Cards",
    body: "When a card is upright, its meaning flows naturally. It represents the card's core energy expressed openly in your life or reading.",
  },
  {
    icon: "swap-vertical",
    title: "Reversed Cards",
    body: "When a card appears reversed (upside-down), its meaning is blocked, delayed, internal, or shadow-side. Not 'bad' — just a different lesson.",
  },
  {
    icon: "compass",
    title: "Reflection, not prediction",
    body: "Tarot is a mirror for what's already in you — a way to ask better questions of yourself. It offers guidance and perspective, never certain predictions of the future.",
  },
];

const TOTAL_STEPS = SLIDES.length + 1; // +1 for the mode-picker step

export function OnboardingModal() {
  const { user, refresh } = useAuth();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [savingMode, setSavingMode] = useState(false);

  useEffect(() => {
    (async () => {
      const seen = await storage.getItem<string>(KEY, "");
      if (!seen) setVisible(true);
    })();
  }, []);

  const finish = async () => {
    await storage.setItem(KEY, "1");
    setVisible(false);
  };

  const next = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
    else finish();
  };

  const pickMode = async (mode: "beginner" | "advanced") => {
    if (savingMode) return;
    setSavingMode(true);
    try {
      await api.setLearningMode(mode);
      await refresh();
    } finally {
      setSavingMode(false);
      next();
    }
  };

  if (!visible) return null;
  const isModeStep = step === 0;
  const s = !isModeStep ? SLIDES[step - 1] : null;
  const isLast = step === TOTAL_STEPS - 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={finish}>
      <View style={styles.backdrop}>
        <StarBg count={40} />
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content}>
            <TouchableOpacity onPress={finish} style={styles.skip} testID="onboarding-skip">
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>

            {isModeStep ? (
              <>
                <View style={styles.iconWrap}>
                  <Ionicons name="school" size={72} color={colors.gold} />
                </View>
                <Text style={styles.title}>How familiar are you with tarot?</Text>
                <Text style={styles.body}>This decides how much detail you see up front — you can change it later in your profile.</Text>

                <View style={styles.modeCards}>
                  <TouchableOpacity
                    onPress={() => pickMode("beginner")}
                    style={[styles.modeCard, (user?.learning_mode ?? "beginner") === "beginner" && styles.modeCardActive]}
                    testID="onboarding-mode-beginner"
                    activeOpacity={0.85}
                    disabled={savingMode}
                  >
                    <Text style={styles.modeCardTitle}>Beginner</Text>
                    <Text style={styles.modeCardBody}>Short, plain-language meanings and examples first. Deeper interpretations are always one tap away.</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => pickMode("advanced")}
                    style={[styles.modeCard, user?.learning_mode === "advanced" && styles.modeCardActive]}
                    testID="onboarding-mode-advanced"
                    activeOpacity={0.85}
                    disabled={savingMode}
                  >
                    <Text style={styles.modeCardTitle}>Advanced</Text>
                    <Text style={styles.modeCardBody}>Full interpretations, imagery, and symbolism shown right away.</Text>
                  </TouchableOpacity>
                </View>
                {savingMode && <ActivityIndicator color={colors.gold} style={{ marginTop: 4 }} />}
              </>
            ) : (
              <>
                <View style={styles.iconWrap}>
                  <Ionicons name={s!.icon as any} size={72} color={colors.gold} />
                </View>
                <Text style={styles.title}>{s!.title}</Text>
                <Text style={styles.body}>{s!.body}</Text>
              </>
            )}

            <View style={styles.dots}>
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === step && styles.dotActive]}
                />
              ))}
            </View>

            {!isModeStep && (
              <TouchableOpacity onPress={next} style={styles.cta} testID={`onboarding-next-${step}`}>
                <Text style={styles.ctaText}>{isLast ? "Begin the Journey" : "Continue"}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, padding: 32, gap: 20, alignItems: "center", justifyContent: "center" },
  skip: { position: "absolute", top: 24, right: 24, padding: 8 },
  skipText: { color: colors.textSecondary, fontFamily: fonts.display, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  iconWrap: {
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.gold,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  title: { color: colors.gold, fontFamily: fonts.display, fontSize: 32, letterSpacing: 2, textAlign: "center" },
  body: { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 16, lineHeight: 26, textAlign: "center", maxWidth: 320 },
  modeCards: { gap: 12, width: "100%", maxWidth: 340, marginTop: 8 },
  modeCard: {
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.borderSoft,
    borderRadius: 18, padding: 16, gap: 6,
  },
  modeCardActive: { borderColor: colors.gold, backgroundColor: colors.surface2 },
  modeCardTitle: { color: colors.gold, fontFamily: fonts.display, fontSize: 16, letterSpacing: 1.5, textTransform: "uppercase" },
  modeCardBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  dots: { flexDirection: "row", gap: 8, marginTop: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.violet },
  dotActive: { backgroundColor: colors.gold, width: 22 },
  cta: { marginTop: 12, backgroundColor: colors.gold, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 999, minWidth: 240, alignItems: "center" },
  ctaText: { color: colors.bg, fontFamily: fonts.body, fontWeight: "700", fontSize: 15, letterSpacing: 1.5, textTransform: "uppercase" },
});
