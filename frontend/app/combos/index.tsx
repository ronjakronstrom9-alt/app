import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSequence, withSpring, withDelay, withRepeat, Easing, interpolate,
} from "react-native-reanimated";
import { useTheme, fonts } from "@/src/theme";
import { api, ComboQuestion, ComboAnswerResult, imageUri } from "@/src/api/client";
import { useAuth } from "@/src/context/auth";
import { StarBg } from "@/src/components/StarBg";
import { XpCelebration, AnimatedNumber } from "@/src/components/XpCelebration";
import { InfoButton } from "@/src/components/GlossaryModal";

const CONTEXT_LABEL: Record<string, string> = {
  love: "Love",
  work: "Work & Purpose",
  growth: "Personal Growth",
};

const CONTEXT_ICON: Record<string, string> = {
  love: "heart",
  work: "briefcase",
  growth: "leaf",
};

export default function CardCombosScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { colors } = useTheme();
  const s = styles(colors);

  const [combo, setCombo] = useState<ComboQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<ComboAnswerResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sessionXp, setSessionXp] = useState(0);

  const loadNext = useCallback(async (excludeId?: string) => {
    setLoading(true);
    setSelected(null);
    setFeedback(null);
    try {
      const next = await api.nextCombo(excludeId);
      setCombo(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNext();
  }, [loadNext]);

  const onPick = (i: number) => {
    if (feedback) return;
    setSelected(i);
  };

  const onCheck = async () => {
    if (selected === null || !combo) return;
    setSubmitting(true);
    try {
      const res = await api.answerCombo(combo.id, selected);
      setFeedback(res);
      if (res.correct) setSessionXp((x) => x + res.xp_earned);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const onContinue = () => {
    loadNext(combo?.id);
  };

  if (loading && !combo) {
    return (
      <View style={[s.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (!combo) {
    return (
      <View style={[s.root, { alignItems: "center", justifyContent: "center", padding: 24 }]}>
        <Text style={s.question}>No card combinations are available yet.</Text>
        <TouchableOpacity style={[s.cta, { marginTop: 20 }]} onPress={() => router.back()}>
          <Text style={s.ctaText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StarBg count={20} />
      <XpCelebration visible={!!feedback?.correct} count={14} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} testID="combos-close-btn">
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={s.headerTitle}>Card Combinations</Text>
              <InfoButton highlight="Card Combinations" />
            </View>
            <Text style={s.headerSub}>{combo.combos_unlocked} / {combo.combos_total} unlocked</Text>
          </View>
          <View style={s.xpBox}>
            <Ionicons name="star" size={16} color={colors.goldGlow} />
            <AnimatedNumber to={sessionXp} style={s.xpText} prefix="+" duration={500} />
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll} testID="combos-scroll">
          <View style={s.contextPill}>
            <Ionicons name={(CONTEXT_ICON[combo.context] || "sparkles") as any} size={12} color={colors.gold} />
            <Text style={s.contextPillText}>{CONTEXT_LABEL[combo.context] || combo.context}</Text>
          </View>

          <CardSpread cards={combo.cards} colors={colors} />

          <FadeInUp key={`${combo.id}-q`} delay={220}>
            <Text style={s.question}>{combo.question}</Text>
          </FadeInUp>

          <View style={s.options}>
            {combo.options.map((opt, i) => {
              const isSel = selected === i;
              const isCorrectAns = feedback && i === feedback.correct_index;
              const isWrongPick = feedback && isSel && !feedback.correct;
              return (
                <FadeInUp key={`${combo.id}-${i}`} delay={300 + i * 90}>
                  <AnimatedOption
                    onPress={() => onPick(i)}
                    disabled={!!feedback}
                    style={[
                      s.option,
                      isSel && !feedback && s.optionSelected,
                      isCorrectAns && s.optionCorrect,
                      isWrongPick && s.optionWrong,
                    ]}
                    pulse={isSel && !feedback}
                    testID={`combo-option-${i}`}
                  >
                    <View
                      style={[
                        s.optionBullet,
                        isSel && !feedback && s.optionBulletActive,
                        isCorrectAns && s.optionBulletCorrect,
                        isWrongPick && s.optionBulletWrong,
                      ]}
                    >
                      {isCorrectAns ? (
                        <Ionicons name="checkmark" size={14} color={colors.bg} />
                      ) : isWrongPick ? (
                        <Ionicons name="close" size={14} color={colors.bg} />
                      ) : isSel ? (
                        <Ionicons name="checkmark" size={14} color={colors.bg} />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        s.optionText,
                        isSel && !feedback && s.optionTextSelected,
                        (isCorrectAns || isWrongPick) && { fontWeight: "600" },
                      ]}
                    >
                      {opt}
                    </Text>
                  </AnimatedOption>
                </FadeInUp>
              );
            })}
          </View>

          {feedback ? (
            <PopIn>
              <View style={[s.explainCard, feedback.correct ? s.explainCardGood : s.explainCardBad]}>
                <View style={s.explainHeader}>
                  <Ionicons
                    name={feedback.correct ? "checkmark-circle" : "moon"}
                    size={20}
                    color={feedback.correct ? colors.green : colors.crimson}
                  />
                  <Text style={[s.explainTitle, { color: feedback.correct ? colors.green : colors.crimson }]}>
                    {feedback.correct ? `Correct — +${feedback.xp_earned} XP` : "Not quite"}
                  </Text>
                </View>
                <Text style={s.explainBody}>{feedback.explanation}</Text>
                {feedback.newly_unlocked ? (
                  <View style={s.unlockRow}>
                    <Ionicons name="lock-open" size={14} color={colors.gold} />
                    <Text style={s.unlockText}>New combination unlocked!</Text>
                  </View>
                ) : null}
              </View>
            </PopIn>
          ) : null}
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity
            style={[s.cta, (selected === null || submitting) && { opacity: 0.5 }]}
            onPress={feedback ? onContinue : onCheck}
            disabled={selected === null || submitting}
            testID="combos-continue-btn"
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={s.ctaText}>{feedback ? "Next Combination" : "Check"}</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function CardSpread({ cards, colors }: { cards: ComboQuestion["cards"]; colors: any }) {
  const s = styles(colors);
  const mid = (cards.length - 1) / 2;
  // 3-4 card combos need smaller tiles and a tighter fan to stay on screen.
  const compact = cards.length >= 4;
  return (
    <View style={s.spreadRow}>
      <SpreadGlow colors={colors} />
      {cards.map((c, i) => (
        <SpreadCard key={c.id} card={c} rotate={(i - mid) * (compact ? 5 : 7)} index={i} colors={colors} compact={compact} />
      ))}
    </View>
  );
}

/** Soft pulsing gold glow behind the card spread, evoking candlelight on a reading table. */
function SpreadGlow({ colors }: { colors: any }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * 0.2,
    transform: [{ scale: 1 + pulse.value * 0.08 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute", width: 220, height: 140, borderRadius: 999,
          backgroundColor: colors.goldGlow,
          top: "50%", marginTop: -70,
          left: "50%", marginLeft: -110,
        },
        style,
      ]}
    />
  );
}

function SpreadCard({
  card, rotate, index, colors, compact,
}: { card: { name: string; image_url: string }; rotate: number; index: number; colors: any; compact?: boolean }) {
  const s = styles(colors);
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withDelay(
      index * 130,
      withSpring(1, { damping: 11, stiffness: 90 }),
    );
  }, [card.name]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 0.4, 1], [0, 1, 1]),
    transform: [
      { translateY: interpolate(enter.value, [0, 1], [30, 0]) },
      { scale: interpolate(enter.value, [0, 1], [0.85, 1]) },
      { rotate: `${rotate}deg` },
    ],
  }));
  return (
    <Animated.View style={[s.spreadCardWrap, compact && { marginHorizontal: -10 }, style]}>
      <Image
        source={{ uri: imageUri(card.image_url) }}
        style={[s.spreadCardImg, compact && { width: 72 }]}
        resizeMode="cover"
      />
      <Text style={[s.spreadCardName, compact && { fontSize: 9, maxWidth: 72 }]} numberOfLines={1}>{card.name}</Text>
    </Animated.View>
  );
}

/** Simple fade + rise-in wrapper for staggering the reveal of question/options. */
function FadeInUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withDelay(delay, withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) }));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: interpolate(enter.value, [0, 1], [14, 0]) }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Gentle spring pop-in, used for the feedback/explanation card. */
function PopIn({ children }: { children: React.ReactNode }) {
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withSpring(1, { damping: 14, stiffness: 120 });
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: interpolate(enter.value, [0, 1], [0.92, 1]) }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Answer row with a light bounce whenever it becomes the selected option. */
function AnimatedOption({
  children, onPress, disabled, style, pulse, testID,
}: {
  children: React.ReactNode; onPress: () => void; disabled: boolean; style: any; pulse: boolean; testID?: string;
}) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (pulse) {
      scale.value = withSequence(
        withTiming(1.03, { duration: 110, easing: Easing.out(Easing.cubic) }),
        withSpring(1, { damping: 10, stiffness: 180 }),
      );
    }
  }, [pulse]);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85} style={style} testID={testID}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = (c: any) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: "row", alignItems: "center", gap: 6, padding: 16 },
    iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    headerTitle: { color: c.textPrimary, fontFamily: fonts.display, fontSize: 15, letterSpacing: 1.5 },
    headerSub: { color: c.textSecondary, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginTop: 2 },
    xpBox: {
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: c.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
      borderWidth: 1, borderColor: c.borderSoft, minWidth: 56, justifyContent: "center",
    },
    xpText: { color: c.goldGlow, fontWeight: "700", fontSize: 13 },

    scroll: { padding: 24, gap: 20, paddingBottom: 40 },

    contextPill: {
      flexDirection: "row", alignItems: "center", gap: 6,
      alignSelf: "center", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
      borderWidth: 1, borderColor: c.gold, backgroundColor: c.surface,
    },
    contextPillText: { color: c.gold, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },

    spreadRow: {
      flexDirection: "row", justifyContent: "center", alignItems: "flex-end",
      gap: 4, marginTop: 4, marginBottom: 8, minHeight: 190,
      position: "relative",
    },
    spreadCardWrap: { alignItems: "center", gap: 6, marginHorizontal: -4 },
    spreadCardImg: {
      width: 100, aspectRatio: 0.58, borderRadius: 12,
      borderWidth: 2, borderColor: c.gold, backgroundColor: c.surface2,
      shadowColor: c.gold, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    spreadCardName: {
      color: c.textSecondary, fontSize: 10, letterSpacing: 0.5, maxWidth: 100, textAlign: "center",
    },

    question: {
      color: c.textPrimary, fontFamily: fonts.serif, fontSize: 22, lineHeight: 30, letterSpacing: 0.3,
      textAlign: "center",
    },

    options: { gap: 12 },
    option: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: c.surface, padding: 16, borderRadius: 16,
      borderWidth: 2, borderColor: c.borderSoft,
    },
    optionSelected: { borderColor: c.gold, backgroundColor: c.surface2 },
    optionCorrect: { borderColor: c.green, backgroundColor: c.surface2 },
    optionWrong: { borderColor: c.crimson, backgroundColor: c.surface2 },
    optionBullet: {
      width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: c.borderSoft,
      alignItems: "center", justifyContent: "center",
    },
    optionBulletActive: { backgroundColor: c.gold, borderColor: c.gold },
    optionBulletCorrect: { backgroundColor: c.green, borderColor: c.green },
    optionBulletWrong: { backgroundColor: c.crimson, borderColor: c.crimson },
    optionText: { color: c.textPrimary, fontSize: 15, flex: 1 },
    optionTextSelected: { color: c.gold, fontWeight: "600" },

    explainCard: {
      borderRadius: 16, padding: 16, gap: 8, borderWidth: 1,
    },
    explainCardGood: { backgroundColor: "rgba(74,222,128,0.08)", borderColor: c.green },
    explainCardBad: { backgroundColor: "rgba(232,72,85,0.08)", borderColor: c.crimson },
    explainHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    explainTitle: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 1 },
    explainBody: { color: c.textSecondary, fontSize: 14, lineHeight: 21 },
    unlockRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
    unlockText: { color: c.gold, fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },

    footer: { padding: 20 },
    cta: { backgroundColor: c.gold, paddingVertical: 16, borderRadius: 999, alignItems: "center" },
    ctaText: { color: c.bg, fontWeight: "700", fontSize: 16, letterSpacing: 0.5 },
  });
