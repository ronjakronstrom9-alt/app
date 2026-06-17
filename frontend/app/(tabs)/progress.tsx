import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";
import { api, Progress } from "@/src/api/client";
import { StarBg } from "@/src/components/StarBg";

export default function ProgressScreen() {
  const [data, setData] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const p = await api.progress();
          setData(p);
        } finally {
          setLoading(false);
        }
      })();
    }, []),
  );

  if (loading || !data) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  const xpInLevel = data.xp - data.current_level_xp;
  const xpToNext = Math.max(1, data.next_level_xp - data.current_level_xp);
  const pct = Math.min(100, Math.round((xpInLevel / xpToNext) * 100));

  return (
    <View style={styles.root}>
      <StarBg count={40} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.kicker}>Your Journey</Text>
          <Text style={styles.title} testID="progress-title">Progress</Text>

          {/* Level card */}
          <View style={styles.levelCard} testID="progress-level-card">
            <View style={styles.levelTop}>
              <View>
                <Text style={styles.levelLabel}>Tarot Level</Text>
                <Text style={styles.levelNum}>{data.level}</Text>
              </View>
              <Ionicons name="trophy" size={48} color={colors.gold} />
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.levelXp}>
              {xpInLevel} / {xpToNext} XP to Level {data.level + 1}
            </Text>
          </View>

          {/* Stats grid */}
          <View style={styles.grid}>
            <StatTile icon="flame" label="Day Streak" value={data.streak} color={colors.gold} testID="stat-tile-streak" />
            <StatTile icon="heart" label="Hearts" value={data.hearts} color={colors.crimson} testID="stat-tile-hearts" />
            <StatTile icon="star" label="Total XP" value={data.xp} color={colors.goldGlow} testID="stat-tile-xp" />
            <StatTile icon="checkmark-done" label="Lessons" value={`${data.completed_lessons}/${data.total_lessons}`} color={colors.green} testID="stat-tile-lessons" />
          </View>

          {/* Completion */}
          <View style={styles.completionCard}>
            <Text style={styles.completionTitle}>Mastery</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${data.completion_pct}%` }]} />
            </View>
            <Text style={styles.completionText} testID="progress-completion-text">
              {data.completion_pct}% of the Major Arcana mastered
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function StatTile({ icon, label, value, color, testID }: any) {
  return (
    <View style={styles.tile} testID={testID}>
      <Ionicons name={icon} size={28} color={color} />
      <Text style={[styles.tileValue, { color }]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 80 },
  kicker: { color: colors.gold, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  title: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 30, marginTop: 4, marginBottom: 20 },
  levelCard: {
    backgroundColor: colors.surface,
    borderRadius: 22, padding: 22,
    borderWidth: 1, borderColor: colors.border,
    gap: 14,
  },
  levelTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  levelLabel: { color: colors.textSecondary, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" },
  levelNum: { color: colors.gold, fontFamily: fonts.display, fontSize: 56, lineHeight: 60 },
  barTrack: { height: 8, backgroundColor: colors.bg2, borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.gold },
  levelXp: { color: colors.textSecondary, fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 18 },
  tile: {
    flexBasis: "47%", flexGrow: 1,
    backgroundColor: colors.surface, padding: 18, borderRadius: 18,
    borderWidth: 1, borderColor: colors.borderSoft, gap: 8,
  },
  tileValue: { fontFamily: fonts.display, fontSize: 26 },
  tileLabel: { color: colors.textSecondary, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  completionCard: {
    marginTop: 18, backgroundColor: colors.surface, padding: 20, borderRadius: 18,
    borderWidth: 1, borderColor: colors.borderSoft, gap: 10,
  },
  completionTitle: { color: colors.gold, fontFamily: fonts.display, fontSize: 18 },
  completionText: { color: colors.textSecondary, fontSize: 13 },
});
