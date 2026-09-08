import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";
import { useAuth } from "@/src/context/auth";
import { api, Card, Lesson, imageUri, invalidateStaticCache } from "@/src/api/client";
import { StarBg } from "@/src/components/StarBg";
import { DailyCardWidget } from "@/src/components/DailyCardWidget";
import { OnboardingModal } from "@/src/components/OnboardingModal";

export default function Home() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [cards, setCards] = useState<Record<string, Card>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ls, cs] = await Promise.all([api.listLessons(), api.listCards()]);
      setLessons(ls);
      const map: Record<string, Card> = {};
      cs.forEach((c) => (map[c.id] = c));
      setCards(map);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh user data (XP, hearts, streak) on tab focus so it stays current
  // after finishing a lesson. Cards/lessons are cached in api client so
  // load() returns instantly on subsequent calls (no re-fetch, no re-render).
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    invalidateStaticCache();
    await Promise.all([refresh(), load()]);
    setRefreshing(false);
  }, [refresh, load]);

  if (!user) return null;
  const completed = useMemo(() => new Set(user.completed_lessons), [user.completed_lessons]);

  return (
    <View style={styles.root}>
      <StarBg count={30} />
      <OnboardingModal />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Sticky header */}
        <View style={styles.header} testID="home-header">
          <View>
            <Text style={styles.hi}>Welcome back</Text>
            <Text style={styles.name} testID="home-user-name">{user.name}</Text>
          </View>
          <View style={styles.stats}>
            <Stat icon="flame" value={user.streak} color={colors.gold} testID="stat-streak" />
            <Stat icon="heart" value={user.hearts} color={colors.crimson} testID="stat-hearts" />
            <Stat icon="star" value={user.xp} color={colors.goldGlow} testID="stat-xp" />
          </View>
        </View>

        <View style={styles.levelBar} testID="level-bar">
          <Text style={styles.levelText}>Level {user.level} — Seeker</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${Math.min(100, (user.xp % 100))}%` }]} />
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            removeClippedSubviews
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
            }
            testID="home-scroll"
          >
            <DailyCardWidget />
            <Text style={styles.sectionTitle}>Your Path</Text>
            <Text style={styles.sectionSub}>Walk the road of the Major Arcana</Text>

            <View style={styles.path}>
              {lessons.map((lesson, idx) => {
                const card = cards[lesson.card_id];
                const isCompleted = completed.has(lesson.id);
                const prevCompleted = idx === 0 || completed.has(lessons[idx - 1]?.id);
                const isCurrent = !isCompleted && prevCompleted;
                const isLocked = !isCompleted && !isCurrent;
                const align = idx % 2 === 0 ? "flex-start" : "flex-end";

                return (
                  <View key={lesson.id} style={[styles.nodeRow, { alignItems: "center", justifyContent: align as any }]}>
                    {idx > 0 && (
                      <View
                        style={[
                          styles.connector,
                          {
                            left: idx % 2 === 0 ? "30%" : "auto",
                            right: idx % 2 === 0 ? "auto" : "30%",
                            borderColor: isCompleted || prevCompleted ? colors.gold : colors.violet,
                            borderStyle: isLocked ? "dashed" : "solid",
                          },
                        ]}
                      />
                    )}
                    <TouchableOpacity
                      activeOpacity={0.85}
                      disabled={isLocked}
                      onPress={() => router.push(`/lesson/${lesson.id}`)}
                      style={[
                        styles.node,
                        isCompleted && styles.nodeCompleted,
                        isCurrent && styles.nodeCurrent,
                        isLocked && styles.nodeLocked,
                      ]}
                      testID={`lesson-node-${idx}`}
                    >
                      {card?.image_url ? (
                        <Image
                          source={{ uri: imageUri(card.image_url) }}
                          style={styles.nodeImage}
                        />
                      ) : (
                        <Text style={styles.nodeEmoji}>🃏</Text>
                      )}
                      {isCompleted && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark" size={14} color={colors.bg} />
                        </View>
                      )}
                      {isLocked && (
                        <View style={styles.lockBadge}>
                          <Ionicons name="lock-closed" size={12} color={colors.textSecondary} />
                        </View>
                      )}
                    </TouchableOpacity>
                    <View style={[styles.nodeLabel, { alignItems: align as any }]}>
                      <Text style={[styles.nodeLabelTitle, isLocked && { color: colors.textMuted }]} numberOfLines={1}>
                        {card?.name || "Lesson"}
                      </Text>
                      <Text style={styles.nodeLabelSub}>
                        {isCompleted ? "Mastered" : isCurrent ? "Continue" : "Locked"}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function Stat({ icon, value, color, testID }: any) {
  return (
    <View style={styles.statItem} testID={testID}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
  },
  hi: { color: colors.textSecondary, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" },
  name: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 22, marginTop: 2 },
  stats: { flexDirection: "row", gap: 10 },
  statItem: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1, borderColor: colors.borderSoft,
  },
  statValue: { fontSize: 13, fontWeight: "700" },
  levelBar: { paddingHorizontal: 20, paddingBottom: 6 },
  levelText: { color: colors.gold, fontSize: 12, letterSpacing: 1.5, marginBottom: 6, textTransform: "uppercase" },
  barTrack: { height: 6, backgroundColor: colors.surface, borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.gold, borderRadius: 999 },
  scroll: { padding: 20, paddingBottom: 60 },
  sectionTitle: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 26, marginTop: 8 },
  sectionSub: { color: colors.textSecondary, fontSize: 14, marginBottom: 24 },
  path: { gap: 32, paddingVertical: 8 },
  nodeRow: { flexDirection: "row", gap: 14, position: "relative", width: "100%" },
  connector: {
    position: "absolute",
    top: -28, height: 28, width: 2, borderLeftWidth: 2, borderColor: colors.gold,
  },
  node: {
    width: 88, height: 124, borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.borderSoft,
    marginLeft: 24, marginRight: 24,
    overflow: "hidden",
  },
  nodeCompleted: { borderColor: colors.goldGlow },
  nodeCurrent: { borderColor: colors.gold, backgroundColor: colors.surface2 },
  nodeLocked: { backgroundColor: colors.surface2, borderColor: colors.violet, opacity: 0.7 },
  nodeImage: { width: "100%", height: "100%" },
  nodeEmoji: { fontSize: 38 },
  checkBadge: {
    position: "absolute", bottom: -4, right: -4, width: 24, height: 24,
    borderRadius: 12, backgroundColor: colors.green, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.bg,
  },
  lockBadge: {
    position: "absolute", bottom: -4, right: -4, width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  nodeLabel: { flex: 1, justifyContent: "center", maxWidth: 140 },
  nodeLabelTitle: { color: colors.textPrimary, fontFamily: fonts.display, fontWeight: "700", fontSize: 16, letterSpacing: 1 },
  nodeLabelSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2, letterSpacing: 1, textTransform: "uppercase" },
});
