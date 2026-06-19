import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";
import { api, Card, Lesson, imageUri } from "@/src/api/client";
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

  const totalSteps = lesson.sections.length + 1;
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
              <View style={styles.cardFrame}>
                <Image source={{ uri: imageUri(card.image_url) }} style={styles.cardImage} resizeMode="cover" />
                <View style={styles.cardFooter}>
                  <Text style={styles.cardFooterRoman}>
                    {toRoman(card.number)}
                  </Text>
                  <Text style={styles.cardFooterName}>{card.name.toUpperCase()}</Text>
                </View>
              </View>

              <Text style={styles.lessonTitle} testID="lesson-intro-title">{lesson.intro}</Text>
              <Text style={styles.lessonSubtitle}>{lesson.subtitle}</Text>

              <View style={styles.kwGroup}>
                {card.keywords_upright.slice(0, 4).map((k) => (
                  <View key={k} style={styles.kwChip}>
                    <Text style={styles.kwText}>{k}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.sectionBlock} testID={`lesson-section-${step - 1}`}>
              <View style={styles.sectionMarker}>
                <Ionicons name="moon" size={14} color={colors.gold} />
                <Text style={styles.sectionKicker}>Section {step} of {lesson.sections.length}</Text>
              </View>
              <Text style={styles.sectionHeading}>{section!.heading}</Text>
              <View style={styles.divider} />
              <Text style={styles.sectionBody}>{section!.body}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cta} onPress={onNext} testID="lesson-next-btn" activeOpacity={0.85}>
            <Text style={styles.ctaText}>
              {step < totalSteps - 1 ? "Continue" : "Begin Quiz"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function toRoman(n: number): string {
  if (n === 0) return "0";
  const map: [number, string][] = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = ""; let v = n;
  for (const [val, sym] of map) {
    while (v >= val) { out += sym; v -= val; }
  }
  return out;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  progressBar: { flex: 1, height: 8, backgroundColor: colors.surface, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.gold },
  scroll: { padding: 24, paddingBottom: 40, gap: 18 },
  introBlock: { gap: 20, alignItems: "center" },
  cardFrame: {
    width: "100%", maxWidth: 260,
    backgroundColor: colors.surface,
    borderRadius: 18, borderWidth: 2, borderColor: colors.gold,
    overflow: "hidden",
  },
  cardImage: { width: "100%", aspectRatio: 0.58, backgroundColor: colors.surface2 },
  cardFooter: {
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: colors.bg2,
    borderTopWidth: 1, borderTopColor: colors.borderSoft,
    alignItems: "center", gap: 2,
  },
  cardFooterRoman: { color: colors.gold, fontFamily: fonts.display, fontSize: 16, letterSpacing: 4 },
  cardFooterName: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 14, letterSpacing: 3 },
  lessonTitle: {
    color: colors.gold,
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 42,
    textAlign: "center",
    letterSpacing: 1,
    marginTop: 6,
    fontWeight: "600",
  },
  lessonSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
    letterSpacing: 0.5,
    marginTop: -8,
  },
  kwGroup: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 8 },
  kwChip: {
    borderWidth: 1, borderColor: colors.gold, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  kwText: { color: colors.gold, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  sectionBlock: { gap: 14 },
  sectionMarker: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionKicker: { color: colors.gold, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  sectionHeading: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: colors.border, width: 60, marginVertical: 6 },
  sectionBody: { color: colors.textPrimary, fontSize: 16, lineHeight: 26, letterSpacing: 0.2 },
  footer: { padding: 20 },
  cta: { backgroundColor: colors.gold, paddingVertical: 16, borderRadius: 999, alignItems: "center" },
  ctaText: { color: colors.bg, fontWeight: "700", fontSize: 16, letterSpacing: 0.5 },
});
