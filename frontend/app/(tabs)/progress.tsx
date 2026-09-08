import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "@/src/theme";
import { api, Progress, Achievement } from "@/src/api/client";
import { StarBg } from "@/src/components/StarBg";

export default function ProgressScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = styles(colors);
  const [data, setData] = useState<Progress | null>(null);
  const [ach, setAch] = useState<{ total: number; unlocked: number; items: Achievement[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const [p, a] = await Promise.all([api.progress(), api.achievements()]);
          setData(p); setAch(a);
        } finally { setLoading(false); }
      })();
    }, []),
  );

  if (loading || !data) {
    return (
      <View style={[s.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  const xpInLevel = data.xp - data.current_level_xp;
  const xpToNext = Math.max(1, data.next_level_xp - data.current_level_xp);
  const pct = Math.min(100, Math.round((xpInLevel / xpToNext) * 100));

  return (
    <View style={s.root}>
      <StarBg count={20} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={s.backBtn} testID="progress-back-btn">
              <Ionicons name="chevron-back" size={26} color={colors.gold} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.kicker}>Your Journey</Text>
              <Text style={s.title} testID="progress-title">Progress</Text>
            </View>
          </View>

          <View style={s.levelCard} testID="progress-level-card">
            <View style={s.levelTop}>
              <View>
                <Text style={s.levelLabel}>Tarot Level</Text>
                <Text style={s.levelNum}>{data.level}</Text>
              </View>
              <Ionicons name="trophy" size={48} color={colors.gold} />
            </View>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${pct}%` }]} />
            </View>
            <Text style={s.levelXp}>{xpInLevel} / {xpToNext} XP to Level {data.level + 1}</Text>
          </View>

          <View style={s.grid}>
            <StatTile icon="flame" label="Day Streak" value={data.streak} color={colors.gold} testID="stat-tile-streak" />
            <StatTile icon="heart" label="Hearts" value={data.hearts} color={colors.crimson} testID="stat-tile-hearts" />
            <StatTile icon="star" label="Total XP" value={data.xp} color={colors.goldGlow} testID="stat-tile-xp" />
            <StatTile icon="checkmark-done" label="Lessons" value={`${data.completed_lessons}/${data.total_lessons}`} color={colors.green} testID="stat-tile-lessons" />
          </View>

          <View style={s.completionCard}>
            <Text style={s.completionTitle}>Mastery</Text>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${data.completion_pct}%` }]} />
            </View>
            <Text style={s.completionText} testID="progress-completion-text">
              {data.completion_pct}% of the deck mastered
            </Text>
          </View>

          {ach ? (
            <View style={s.achWrap} testID="achievements-section">
              <View style={s.achHeader}>
                <View>
                  <Text style={s.kicker}>Achievements</Text>
                  <Text style={s.achTitle}>{ach.unlocked} / {ach.total} Unlocked</Text>
                </View>
                <View style={s.achBadge}>
                  <Ionicons name="ribbon" size={18} color={colors.gold} />
                </View>
              </View>
              <View style={s.achList}>
                {ach.items.map((a) => (
                  <AchTile key={a.id} a={a} colors={colors} />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function AchTile({ a, colors }: { a: Achievement; colors: any }) {
  const s = styles(colors);
  return (
    <View style={[s.achTile, a.unlocked && s.achTileUnlocked]} testID={`ach-${a.id}`}>
      <View
        style={[
          s.achIcon,
          {
            borderColor: a.unlocked ? colors.gold : colors.borderSoft,
            backgroundColor: a.unlocked ? colors.surface2 : colors.surface,
          },
        ]}
      >
        <Ionicons
          name={a.unlocked ? (a.icon as any) : "lock-closed"}
          size={22}
          color={a.unlocked ? colors.gold : colors.textMuted}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.achName, !a.unlocked && { color: colors.textSecondary }]}>{a.title}</Text>
        <Text style={s.achDesc}>{a.description}</Text>
        {!a.unlocked ? (
          <View style={s.achProgressTrack}>
            <View style={[s.achProgressFill, { width: `${a.pct}%` }]} />
          </View>
        ) : null}
        <Text style={s.achMeta}>{a.unlocked ? "Unlocked" : `${a.progress} / ${a.target}`}</Text>
      </View>
    </View>
  );
}

function StatTile({ icon, label, value, color, testID }: any) {
  const { colors } = useTheme();
  const s = styles(colors);
  return (
    <View style={s.tile} testID={testID}>
      <Ionicons name={icon} size={28} color={color} />
      <Text style={[s.tileValue, { color }]}>{value}</Text>
      <Text style={s.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = (c: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  scroll: { padding: 20, paddingBottom: 80 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 20 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginTop: 4 },
  kicker: { color: c.gold, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  title: { color: c.textPrimary, fontFamily: fonts.display, fontSize: 30, marginTop: 4 },
  levelCard: {
    backgroundColor: c.surface, borderRadius: 22, padding: 22,
    borderWidth: 1, borderColor: c.border, gap: 14,
  },
  levelTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  levelLabel: { color: c.textSecondary, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" },
  levelNum: { color: c.gold, fontFamily: fonts.display, fontSize: 56, lineHeight: 60 },
  barTrack: { height: 8, backgroundColor: c.bg2, borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: c.gold },
  levelXp: { color: c.textSecondary, fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 18 },
  tile: {
    flexBasis: "47%", flexGrow: 1, backgroundColor: c.surface, padding: 18, borderRadius: 18,
    borderWidth: 1, borderColor: c.borderSoft, gap: 8,
  },
  tileValue: { fontFamily: fonts.display, fontSize: 26 },
  tileLabel: { color: c.textSecondary, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  completionCard: {
    marginTop: 18, backgroundColor: c.surface, padding: 20, borderRadius: 18,
    borderWidth: 1, borderColor: c.borderSoft, gap: 10,
  },
  completionTitle: { color: c.gold, fontFamily: fonts.display, fontSize: 18 },
  completionText: { color: c.textSecondary, fontSize: 13 },
  achWrap: { marginTop: 24, gap: 12 },
  achHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  achTitle: { color: c.textPrimary, fontFamily: fonts.display, fontSize: 22, marginTop: 2 },
  achBadge: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: c.gold,
    alignItems: "center", justifyContent: "center", backgroundColor: c.surface,
  },
  achList: { gap: 10 },
  achTile: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: c.surface, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: c.borderSoft,
  },
  achTileUnlocked: { borderColor: c.gold, backgroundColor: c.surface2 },
  achIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  achName: { color: c.textPrimary, fontFamily: fonts.display, fontSize: 14, letterSpacing: 1.4 },
  achDesc: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  achProgressTrack: { height: 4, backgroundColor: c.bg2, borderRadius: 999, marginTop: 8, overflow: "hidden" },
  achProgressFill: { height: "100%", backgroundColor: c.gold },
  achMeta: { color: c.gold, fontSize: 10, letterSpacing: 1.5, marginTop: 6, textTransform: "uppercase" },
});
