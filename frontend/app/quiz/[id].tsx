import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";
import { api, QuizQuestion, QuizResult } from "@/src/api/client";
import { useAuth } from "@/src/context/auth";
import { StarBg } from "@/src/components/StarBg";

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { refresh, user } = useAuth();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [heartsLost, setHeartsLost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const q = await api.getQuiz(id);
        setQuestions(q.questions);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (result) {
    return <QuizResultView result={result} onDone={() => router.replace("/(tabs)")} />;
  }

  const q = questions[idx];
  const progress = ((idx + (revealed ? 1 : 0)) / questions.length) * 100;
  const correctIdx = -1; // unknown on client; we infer via reveal returned from backend's explanation? We don't have it. So just no client-side check, but we still want feedback.
  // Since backend doesn't return correct_index in /quizzes/:id, we'll show reveal only after submit. Simpler: no per-q reveal; just collect answers and submit at end.

  const onPick = (i: number) => {
    if (revealed) return;
    setSelected(i);
  };

  const onContinue = async () => {
    if (selected === null) return;
    const nextAnswers = [...answers, selected];
    setAnswers(nextAnswers);
    setSelected(null);

    if (idx < questions.length - 1) {
      setIdx(idx + 1);
    } else {
      // submit
      setSubmitting(true);
      try {
        const res = await api.submitQuiz(id, nextAnswers, heartsLost);
        setResult(res);
        await refresh();
      } catch (e) {
        // ignore
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <View style={styles.root}>
      <StarBg count={20} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconBtn}
            testID="quiz-close-btn"
          >
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
          <View style={styles.heartsBox}>
            <Ionicons name="heart" size={16} color={colors.crimson} />
            <Text style={styles.heartsText} testID="quiz-hearts">{Math.max(0, (user?.hearts || 0) - heartsLost)}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.qNumber}>Question {idx + 1} of {questions.length}</Text>
          <Text style={styles.question} testID="quiz-question">{q.question}</Text>

          <View style={styles.options}>
            {q.options.map((opt, i) => {
              const isSelected = selected === i;
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => onPick(i)}
                  activeOpacity={0.85}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  testID={`quiz-option-${i}`}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.cta, (selected === null || submitting) && { opacity: 0.5 }]}
            onPress={onContinue}
            disabled={selected === null || submitting}
            testID="quiz-continue-btn"
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.ctaText}>{idx < questions.length - 1 ? "Continue" : "Finish"}</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function QuizResultView({ result, onDone }: { result: QuizResult; onDone: () => void }) {
  const passed = result.correct >= Math.max(1, Math.round(result.total * 0.6));
  return (
    <View style={styles.root}>
      <StarBg count={40} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.resultBox} testID="quiz-result">
          <Ionicons name={passed ? "star" : "moon"} size={80} color={colors.gold} />
          <Text style={styles.resultTitle}>
            {passed ? "The Stars Align" : "The Path Continues"}
          </Text>
          <Text style={styles.resultSub}>
            {result.correct} / {result.total} correct
          </Text>

          <View style={styles.rewardGrid}>
            <Reward icon="star" label="XP Earned" value={`+${result.xp_earned}`} />
            <Reward icon="flame" label="Streak" value={String(result.new_streak)} />
            <Reward icon="trophy" label="Level" value={String(result.new_level)} />
          </View>

          <TouchableOpacity style={styles.cta} onPress={onDone} testID="quiz-done-btn" activeOpacity={0.85}>
            <Text style={styles.ctaText}>{passed ? "Continue Journey" : "Try Again Later"}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Reward({ icon, label, value }: any) {
  return (
    <View style={styles.reward}>
      <Ionicons name={icon} size={26} color={colors.gold} />
      <Text style={styles.rewardValue}>{value}</Text>
      <Text style={styles.rewardLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  progressBar: { flex: 1, height: 8, backgroundColor: colors.surface, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.gold },
  heartsBox: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8 },
  heartsText: { color: colors.crimson, fontWeight: "700", fontSize: 14 },
  scroll: { padding: 24, gap: 18 },
  qNumber: { color: colors.gold, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  question: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 24, lineHeight: 32, letterSpacing: 0.3 },
  options: { gap: 12, marginTop: 18 },
  option: {
    backgroundColor: colors.surface, padding: 16, borderRadius: 16,
    borderWidth: 2, borderColor: colors.borderSoft,
  },
  optionSelected: { borderColor: colors.gold, backgroundColor: colors.surface2 },
  optionText: { color: colors.textPrimary, fontSize: 15 },
  optionTextSelected: { color: colors.gold, fontWeight: "600" },
  footer: { padding: 20 },
  cta: { backgroundColor: colors.gold, paddingVertical: 16, borderRadius: 999, alignItems: "center" },
  ctaText: { color: colors.bg, fontWeight: "700", fontSize: 16, letterSpacing: 0.5 },
  resultBox: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 16 },
  resultTitle: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 30, textAlign: "center", marginTop: 10, letterSpacing: 3 },
  resultSub: { color: colors.textSecondary, fontSize: 16 },
  rewardGrid: { flexDirection: "row", gap: 12, marginVertical: 28, width: "100%" },
  reward: {
    flex: 1, backgroundColor: colors.surface, padding: 16, borderRadius: 18,
    alignItems: "center", borderWidth: 1, borderColor: colors.border, gap: 6,
  },
  rewardValue: { color: colors.gold, fontFamily: fonts.display, fontSize: 22 },
  rewardLabel: { color: colors.textSecondary, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", textAlign: "center" },
});
