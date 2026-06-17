import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";
import { api, Card, Lesson } from "@/src/api/client";
import { StarBg } from "@/src/components/StarBg";

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const l = await api.getLesson(id);
        setLesson(l);
        const c = await api.getCard(l.card_id);
        setCard(c);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading || !lesson || !card) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  const totalSteps = lesson.sections.length + 1; // intro + sections
  const onNext = () => {
    if (step < totalSteps - 1) setStep(step + 1);
    else router.replace(`/quiz/${lesson.id}`);
  };

  const isIntro = step === 0;
  const section = isIntro ? null : lesson.sections[step - 1];
  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <View style={styles.root}>
      <StarBg count={40} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        {/* Header with progress */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="lesson-close-btn" style={styles.iconBtn}>
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.progressBar} testID="lesson-progress">
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {isIntro ? (
            <View style={styles.introBlock}>
              <View style={styles.cardIllustration}>
                <Text style={styles.cardEmoji}>{card.image_emoji}</Text>
                <Text style={styles.cardNum}>{String(card.number).padStart(2, "0")}</Text>
                <Text style={styles.cardName}>{card.name}</Text>
                <Text style={styles.cardElement}>{card.arcana} Arcana · {card.element}</Text>
              </View>
              <Text style={styles.lessonIntro}>{lesson.intro}</Text>
              <View style={styles.kwGroup}>
                {card.keywords_upright.slice(0, 3).map((k) => (
                  <View key={k} style={styles.kwChip}>
                    <Text style={styles.kwText}>{k}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.sectionBlock} testID={`lesson-section-${step - 1}`}>
              <Text style={styles.sectionHeading}>{section!.heading}</Text>
              <Text style={styles.sectionBody}>{section!.body}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cta} onPress={onNext} testID="lesson-next-btn" activeOpacity={0.85}>
            <Text style={styles.ctaText}>
              {step < totalSteps - 1 ? "Continue" : "Start Quiz"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  progressBar: { flex: 1, height: 8, backgroundColor: colors.surface, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.gold },
  scroll: { padding: 24, paddingBottom: 40 },
  introBlock: { gap: 18, alignItems: "center" },
  cardIllustration: {
    width: "100%", aspectRatio: 0.7, maxWidth: 280,
    backgroundColor: colors.surface,
    borderRadius: 22, borderWidth: 2, borderColor: colors.gold,
    alignItems: "center", justifyContent: "center", padding: 18, gap: 10,
  },
  cardEmoji: { fontSize: 90 },
  cardNum: { color: colors.gold, fontFamily: fonts.display, fontSize: 18 },
  cardName: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 26, textAlign: "center" },
  cardElement: { color: colors.textSecondary, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" },
  lessonIntro: { color: colors.textPrimary, fontSize: 16, textAlign: "center", lineHeight: 24, fontStyle: "italic" },
  kwGroup: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  kwChip: {
    borderWidth: 1, borderColor: colors.gold, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  kwText: { color: colors.gold, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  sectionBlock: { gap: 14 },
  sectionHeading: { color: colors.gold, fontFamily: fonts.display, fontSize: 28 },
  sectionBody: { color: colors.textPrimary, fontSize: 16, lineHeight: 26 },
  footer: { padding: 20 },
  cta: { backgroundColor: colors.gold, paddingVertical: 16, borderRadius: 999, alignItems: "center" },
  ctaText: { color: colors.bg, fontWeight: "700", fontSize: 16, letterSpacing: 0.5 },
});
