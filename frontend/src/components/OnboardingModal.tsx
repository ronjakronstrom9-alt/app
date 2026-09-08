import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts } from "@/src/theme";
import { storage } from "@/src/utils/storage";
import { StarBg } from "@/src/components/StarBg";

const KEY = "mt_onboarding_v1";

const SLIDES = [
  {
    icon: "moon",
    title: "Welcome to Mystic XP",
    body: "Tarot is a symbolic language for reflection — 78 archetypal images that mirror the human journey. This app teaches you to read them.",
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

export function OnboardingModal() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

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
    if (step < SLIDES.length - 1) setStep(step + 1);
    else finish();
  };

  if (!visible) return null;
  const s = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={finish}>
      <View style={styles.backdrop}>
        <StarBg count={40} />
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content}>
            <TouchableOpacity onPress={finish} style={styles.skip} testID="onboarding-skip">
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>

            <View style={styles.iconWrap}>
              <Ionicons name={s.icon as any} size={72} color={colors.gold} />
            </View>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>

            <View style={styles.dots}>
              {SLIDES.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === step && styles.dotActive]}
                />
              ))}
            </View>

            <TouchableOpacity onPress={next} style={styles.cta} testID={`onboarding-next-${step}`}>
              <Text style={styles.ctaText}>{isLast ? "Begin the Journey" : "Continue"}</Text>
            </TouchableOpacity>
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
  dots: { flexDirection: "row", gap: 8, marginTop: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.violet },
  dotActive: { backgroundColor: colors.gold, width: 22 },
  cta: { marginTop: 12, backgroundColor: colors.gold, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 999, minWidth: 240, alignItems: "center" },
  ctaText: { color: colors.bg, fontFamily: fonts.body, fontWeight: "700", fontSize: 15, letterSpacing: 1.5, textTransform: "uppercase" },
});
