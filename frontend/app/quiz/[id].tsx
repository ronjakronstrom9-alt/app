import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { useTheme, fonts } from "@/src/theme";
import { api, QuizQuestion, QuizResult, imageUri, Achievement } from "@/src/api/client";
import { useAuth } from "@/src/context/auth";
import { StarBg } from "@/src/components/StarBg";
import { XpCelebration, AnimatedNumber, StreakBadge } from "@/src/components/XpCelebration";

type Feedback = null | "locked";

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { refresh, user } = useAuth();
  const { colors } = useTheme();
  const s = styles(colors);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [heartsLost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const progressAnim = useSharedValue(0);

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

  useEffect(() => {
    if (!questions.length) return;
    const pct = ((idx + (feedback ? 1 : 0)) / questions.length) * 100;
    progressAnim.value = withTiming(pct, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [idx, feedback, questions.length]);

  const progressStyle = useAnimatedStyle(() => ({ width: `${progressAnim.value}%` }));

  if (loading) {
    return (
      <View style={[s.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (result) {
    return <QuizResultView result={result} onDone={() => router.replace("/(tabs)")} />;
  }

  const q = questions[idx];
  const isFinal = idx === questions.length - 1;
  const heartsRemaining = Math.max(0, (user?.hearts || 0) - heartsLost);

  const onPick = (i: number) => {
    if (feedback) return;
    setSelected(i);
  };

  const onCheck = () => {
    if (selected === null) return;
    setFeedback("locked");
  };

  const onContinue = async () => {
    if (selected === null) return;
    const nextAnswers = [...answers, selected];
    setAnswers(nextAnswers);
    setSelected(null);
    setFeedback(null);

    if (idx < questions.length - 1) {
      setIdx(idx + 1);
    } else {
      setSubmitting(true);
      try {
        const res = await api.submitQuiz(id, nextAnswers, heartsLost);
        setResult(res);
        await refresh();
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <View style={s.root}>
      <StarBg count={20} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} testID="quiz-close-btn">
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={s.progressBar}>
            <Animated.View style={[s.progressFill, progressStyle]} />
          </View>
          <View style={s.heartsBox}>
            <Ionicons name="heart" size={16} color={colors.crimson} />
            <Text style={s.heartsText} testID="quiz-hearts">{heartsRemaining}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.qNumber}>
            {qKindLabel(q.question_type)} · {idx + 1} of {questions.length}
          </Text>
          <QuestionBody
            q={q}
            selected={selected}
            onPick={onPick}
            locked={!!feedback}
            colors={colors}
          />
        </ScrollView>

        <View style={s.footer}>
          {feedback ? (
            <View style={s.feedbackCard} testID="quiz-feedback">
              <Ionicons name="checkmark-circle" size={22} color={colors.gold} />
              <Text style={s.feedbackText}>Locked in — the stars will weigh your answer.</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[s.cta, (selected === null || submitting) && { opacity: 0.5 }]}
            onPress={feedback ? onContinue : onCheck}
            disabled={selected === null || submitting}
            testID="quiz-continue-btn"
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={s.ctaText}>
                {feedback ? (isFinal ? "Finish" : "Continue") : "Check"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ============ QUESTION BODY ============
function QuestionBody({
  q, selected, onPick, locked, colors,
}: {
  q: QuizQuestion;
  selected: number | null;
  onPick: (i: number) => void;
  locked: boolean;
  colors: any;
}) {
  const s = styles(colors);
  const type = q.question_type || "mcq";

  if (type === "match_image") {
    return (
      <View style={{ gap: 18 }}>
        <Text style={s.question}>{q.question}</Text>
        {q.image_url ? (
          <View style={s.imageWrap}>
            <Image source={{ uri: imageUri(q.image_url) }} style={s.image} resizeMode="cover" />
          </View>
        ) : null}
        <OptionsGrid options={q.options} selected={selected} onPick={onPick} locked={locked} colors={colors} />
      </View>
    );
  }

  if (type === "reversed_detect") {
    return (
      <View style={{ gap: 18 }}>
        <Text style={s.question}>{q.question}</Text>
        <View style={s.reversedRow}>
          {q.options.map((opt, i) => {
            const isSel = selected === i;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => onPick(i)}
                disabled={locked}
                activeOpacity={0.85}
                style={[s.reversedTile, isSel && s.reversedTileActive]}
                testID={`quiz-option-${i}`}
              >
                <Ionicons
                  name={i === 0 ? "arrow-up" : "arrow-down"}
                  size={36}
                  color={isSel ? colors.gold : colors.textSecondary}
                />
                <Text style={[s.reversedText, isSel && { color: colors.gold, fontWeight: "700" }]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  if (type === "keyword_pick") {
    return (
      <View style={{ gap: 18 }}>
        <Text style={s.question}>{q.question}</Text>
        <View style={s.keywordWrap}>
          {q.options.map((opt, i) => {
            const isSel = selected === i;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => onPick(i)}
                disabled={locked}
                activeOpacity={0.85}
                style={[s.keywordPill, isSel && s.keywordPillActive]}
                testID={`quiz-option-${i}`}
              >
                <Text style={[s.keywordText, isSel && s.keywordTextActive]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // mcq / match_meaning — same stacked list layout
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.question}>{q.question}</Text>
      <View style={s.options}>
        {q.options.map((opt, i) => {
          const isSel = selected === i;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => onPick(i)}
              disabled={locked}
              activeOpacity={0.85}
              style={[s.option, isSel && s.optionSelected]}
              testID={`quiz-option-${i}`}
            >
              <View style={[s.optionBullet, isSel && s.optionBulletActive]}>
                {isSel ? <Ionicons name="checkmark" size={14} color={colors.bg} /> : null}
              </View>
              <Text style={[s.optionText, isSel && s.optionTextSelected]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function OptionsGrid({
  options, selected, onPick, locked, colors,
}: { options: string[]; selected: number | null; onPick: (i: number) => void; locked: boolean; colors: any }) {
  const s = styles(colors);
  return (
    <View style={s.gridWrap}>
      {options.map((opt, i) => {
        const isSel = selected === i;
        return (
          <TouchableOpacity
            key={i}
            onPress={() => onPick(i)}
            disabled={locked}
            activeOpacity={0.85}
            style={[s.gridTile, isSel && s.gridTileActive]}
            testID={`quiz-option-${i}`}
          >
            <Text style={[s.gridTileText, isSel && s.gridTileTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function qKindLabel(t?: string): string {
  switch (t) {
    case "match_image": return "IMAGE MATCH";
    case "reversed_detect": return "ORIENTATION";
    case "keyword_pick": return "KEYWORD";
    case "match_meaning": return "MEANING";
    default: return "QUESTION";
  }
}

// ============ RESULT VIEW ============
function QuizResultView({ result, onDone }: { result: QuizResult; onDone: () => void }) {
  const { colors } = useTheme();
  const passed = result.correct >= Math.max(1, Math.round(result.total * 0.6));
  const isPerfect = result.perfect || result.correct === result.total;
  const s = styles(colors);

  const titleScale = useSharedValue(0);
  const rewardOpacity = useSharedValue(0);
  const rewardY = useSharedValue(30);

  useEffect(() => {
    titleScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withSpring(1, { damping: 8, stiffness: 90 }),
    );
    rewardOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
    rewardY.value = withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, []);

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: titleScale.value }],
    opacity: interpolate(titleScale.value, [0, 0.5, 1], [0, 0.5, 1]),
  }));
  const rewardStyle = useAnimatedStyle(() => ({
    opacity: rewardOpacity.value,
    transform: [{ translateY: rewardY.value }],
  }));

  return (
    <View style={s.root}>
      <StarBg count={30} />
      <XpCelebration visible={isPerfect || passed} count={isPerfect ? 26 : 14} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={s.resultBox} testID="quiz-result">
          <Animated.View style={[{ alignItems: "center" }, titleStyle]}>
            <Ionicons
              name={isPerfect ? "sparkles" : passed ? "star" : "moon"}
              size={80}
              color={colors.gold}
            />
            <Text style={s.resultTitle}>
              {isPerfect ? "Flawless!" : passed ? "The Stars Align" : "The Path Continues"}
            </Text>
            <Text style={s.resultSub}>
              {result.correct} / {result.total} correct
            </Text>
          </Animated.View>

          <Animated.View style={[s.rewardGrid, rewardStyle]}>
            <Reward icon="star" label="XP Earned" value={result.xp_earned} bonus={result.xp_streak_bonus} colors={colors} />
            <Reward icon="trophy" label="Level" value={result.new_level} colors={colors} />
          </Animated.View>

          <StreakBadge streak={result.new_streak} bonus={result.xp_streak_bonus} />

          {result.achievements_unlocked && result.achievements_unlocked.length > 0 ? (
            <View style={s.achievementsBlock}>
              <Text style={s.blockTitle}>UNLOCKED</Text>
              {result.achievements_unlocked.map((a) => (
                <AchievementUnlockRow key={a.id} a={a} colors={colors} />
              ))}
            </View>
          ) : null}

          <TouchableOpacity
            style={[s.cta, { alignSelf: "stretch", marginTop: 12 }]}
            onPress={onDone}
            testID="quiz-done-btn"
            activeOpacity={0.85}
          >
            <Text style={s.ctaText}>{passed ? "Continue Journey" : "Return"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function AchievementUnlockRow({ a, colors }: { a: Achievement; colors: any }) {
  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withSequence(
      withTiming(0, { duration: 200 }),
      withSpring(1, { damping: 9, stiffness: 100 }),
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(scale.value, [0, 1], [0, 1]),
  }));
  const s = styles(colors);
  return (
    <Animated.View style={[s.achieveRow, style]}>
      <View style={[s.achieveIcon, { borderColor: colors.gold, backgroundColor: colors.surface2 }]}>
        <Ionicons name={a.icon as any} size={20} color={colors.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.achieveTitle}>{a.title}</Text>
        <Text style={s.achieveDesc}>{a.description}</Text>
      </View>
    </Animated.View>
  );
}

function Reward({ icon, label, value, bonus, colors }: any) {
  const s = styles(colors);
  return (
    <View style={s.reward}>
      <Ionicons name={icon} size={26} color={colors.gold} />
      <AnimatedNumber
        to={value}
        style={[s.rewardValue, { color: colors.gold, fontFamily: fonts.display }]}
        prefix={label === "XP Earned" ? "+" : ""}
      />
      <Text style={s.rewardLabel}>{label}</Text>
      {bonus ? (
        <View style={s.bonusChip}>
          <Ionicons name="flame" size={10} color={colors.bg} />
          <Text style={s.bonusChipText}>+{bonus} streak</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = (c: any) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
    iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    progressBar: {
      flex: 1, height: 8, backgroundColor: c.surface, borderRadius: 999, overflow: "hidden",
    },
    progressFill: { height: "100%", backgroundColor: c.gold },
    heartsBox: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8 },
    heartsText: { color: c.crimson, fontWeight: "700", fontSize: 14 },
    scroll: { padding: 24, gap: 18, paddingBottom: 120 },
    qNumber: { color: c.gold, fontSize: 11, letterSpacing: 3, textTransform: "uppercase" },
    question: {
      color: c.textPrimary, fontFamily: fonts.serif, fontSize: 24, lineHeight: 32, letterSpacing: 0.3,
    },
    options: { gap: 12, marginTop: 4 },
    option: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: c.surface, padding: 16, borderRadius: 16,
      borderWidth: 2, borderColor: c.borderSoft,
    },
    optionSelected: { borderColor: c.gold, backgroundColor: c.surface2 },
    optionBullet: {
      width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: c.borderSoft,
      alignItems: "center", justifyContent: "center",
    },
    optionBulletActive: { backgroundColor: c.gold, borderColor: c.gold },
    optionText: { color: c.textPrimary, fontSize: 15, flex: 1 },
    optionTextSelected: { color: c.gold, fontWeight: "600" },

    imageWrap: {
      alignSelf: "center", width: 220, aspectRatio: 0.58, borderRadius: 14,
      borderWidth: 2, borderColor: c.gold, overflow: "hidden", backgroundColor: c.surface2,
    },
    image: { width: "100%", height: "100%" },

    gridWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    gridTile: {
      flexBasis: "48%", flexGrow: 1,
      backgroundColor: c.surface, borderRadius: 14, padding: 14,
      borderWidth: 2, borderColor: c.borderSoft, minHeight: 60,
      alignItems: "center", justifyContent: "center",
    },
    gridTileActive: { borderColor: c.gold, backgroundColor: c.surface2 },
    gridTileText: { color: c.textPrimary, fontSize: 14, textAlign: "center" },
    gridTileTextActive: { color: c.gold, fontWeight: "700" },

    reversedRow: { flexDirection: "row", gap: 14 },
    reversedTile: {
      flex: 1, aspectRatio: 1, backgroundColor: c.surface, borderRadius: 20,
      borderWidth: 2, borderColor: c.borderSoft, alignItems: "center", justifyContent: "center", gap: 12,
    },
    reversedTileActive: { borderColor: c.gold, backgroundColor: c.surface2 },
    reversedText: { color: c.textSecondary, fontSize: 14, letterSpacing: 1.5, textTransform: "uppercase" },

    keywordWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    keywordPill: {
      paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999,
      backgroundColor: c.surface, borderWidth: 2, borderColor: c.borderSoft,
    },
    keywordPillActive: { borderColor: c.gold, backgroundColor: c.gold },
    keywordText: { color: c.textPrimary, fontSize: 14, letterSpacing: 1, textTransform: "uppercase" },
    keywordTextActive: { color: c.bg, fontWeight: "700" },

    footer: { padding: 20, gap: 10 },
    feedbackCard: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: c.surface, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: c.borderSoft,
    },
    feedbackText: { color: c.textPrimary, fontSize: 13, flex: 1 },
    cta: { backgroundColor: c.gold, paddingVertical: 16, borderRadius: 999, alignItems: "center" },
    ctaText: { color: c.bg, fontWeight: "700", fontSize: 16, letterSpacing: 0.5 },

    resultBox: { padding: 24, alignItems: "center", gap: 20, paddingBottom: 80 },
    resultTitle: {
      color: c.textPrimary, fontFamily: fonts.display, fontSize: 30, textAlign: "center",
      marginTop: 14, letterSpacing: 3,
    },
    resultSub: { color: c.textSecondary, fontSize: 16, marginTop: 4 },
    rewardGrid: { flexDirection: "row", gap: 12, width: "100%" },
    reward: {
      flex: 1, backgroundColor: c.surface, padding: 16, borderRadius: 18,
      alignItems: "center", borderWidth: 1, borderColor: c.border, gap: 6,
    },
    rewardValue: { fontSize: 24 },
    rewardLabel: {
      color: c.textSecondary, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", textAlign: "center",
    },
    bonusChip: {
      flexDirection: "row", alignItems: "center", gap: 2,
      backgroundColor: c.gold, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
      marginTop: 4,
    },
    bonusChipText: { color: c.bg, fontSize: 9, fontWeight: "700" },

    achievementsBlock: { width: "100%", gap: 8, marginTop: 6, alignItems: "stretch" },
    blockTitle: { color: c.gold, fontSize: 11, letterSpacing: 3, textAlign: "center", marginBottom: 6 },
    achieveRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: c.surface, padding: 12, borderRadius: 14,
      borderWidth: 1, borderColor: c.gold,
    },
    achieveIcon: {
      width: 40, height: 40, borderRadius: 20, borderWidth: 1,
      alignItems: "center", justifyContent: "center",
    },
    achieveTitle: { color: c.textPrimary, fontFamily: fonts.display, fontSize: 14, letterSpacing: 1.2 },
    achieveDesc: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  });
