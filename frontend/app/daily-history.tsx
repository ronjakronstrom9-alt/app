import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image,
  Modal, TextInput, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";
import { api, DailyEntry, imageUri } from "@/src/api/client";
import { StarBg } from "@/src/components/StarBg";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"]; // Sunday first (JS default)

function pad(n: number) { return n < 10 ? `0${n}` : String(n); }

/** Return list of "cells" for the calendar grid: leading nulls for prev-month
 *  padding, then day numbers 1..lastDay. Total length is a multiple of 7. */
function buildGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const lastDay = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function DailyHistory() {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.dailyHistory(year, month);
      setEntries(res.entries);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const entryByDate = useMemo(() => {
    const map: Record<string, DailyEntry> = {};
    for (const e of entries) map[e.date] = e;
    return map;
  }, [entries]);

  const grid = useMemo(() => buildGrid(year, month), [year, month]);

  const goPrev = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const goNext = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };
  const isFuture = (y: number, m: number) =>
    y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 1);

  const drawnCount = entries.length;
  const openEntry = openDate ? entryByDate[openDate] : null;

  return (
    <View style={styles.root}>
      <StarBg count={20} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="dh-back-btn">
            <Ionicons name="chevron-back" size={26} color={colors.gold} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Card of the Day</Text>
            <Text style={styles.title} testID="dh-title">Your Journal</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Month navigator */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={goPrev} style={styles.navBtn} testID="dh-prev">
              <Ionicons name="chevron-back" size={22} color={colors.gold} />
            </TouchableOpacity>
            <View style={{ alignItems: "center" }}>
              <Text style={styles.monthLabel}>{MONTHS[month - 1]}</Text>
              <Text style={styles.yearLabel}>{year} · {drawnCount} drawn</Text>
            </View>
            <TouchableOpacity
              onPress={goNext}
              disabled={isFuture(year, month + 1) && !(month === 12 && year === now.getFullYear())}
              style={[styles.navBtn, (isFuture(year, month + 1) && !(month === 12 && year === now.getFullYear())) && { opacity: 0.35 }]}
              testID="dh-next"
            >
              <Ionicons name="chevron-forward" size={22} color={colors.gold} />
            </TouchableOpacity>
          </View>

          {/* Weekday header */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={styles.weekday}>{w}</Text>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 30 }} />
          ) : (
            <View style={styles.grid}>
              {grid.map((day, i) => {
                if (day === null) return <View key={`x${i}`} style={styles.cellEmpty} />;
                const iso = `${year}-${pad(month)}-${pad(day)}`;
                const e = entryByDate[iso];
                const isToday = iso === todayIso;
                const isFutureDay =
                  year > now.getFullYear() ||
                  (year === now.getFullYear() && month > now.getMonth() + 1) ||
                  (year === now.getFullYear() && month === now.getMonth() + 1 && day > now.getDate());
                return (
                  <TouchableOpacity
                    key={iso}
                    style={styles.cellOuter}
                    disabled={!e}
                    onPress={() => setOpenDate(iso)}
                    activeOpacity={0.8}
                    testID={`dh-cell-${iso}`}
                  >
                    <View
                      style={[
                        styles.cellInner,
                        e ? styles.cellDrawn : styles.cellMissed,
                        isToday && styles.cellToday,
                        isFutureDay && { opacity: 0.35 },
                      ]}
                    >
                      {e ? (
                        <Image source={{ uri: imageUri(e.image_url) }} style={styles.cellImg} />
                      ) : null}
                      <View style={styles.cellNumWrap}>
                        <Text style={[styles.cellNum, e ? { color: colors.goldGlow } : null]}>{day}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: colors.surface, borderColor: colors.gold }]} />
              <Text style={styles.legendText}>Drawn</Text>
              <View style={{ width: 16 }} />
              <View style={[styles.legendDot, { borderColor: colors.goldGlow, borderWidth: 2, backgroundColor: "transparent" }]} />
              <Text style={styles.legendText}>Today</Text>
              <View style={{ width: 16 }} />
              <View style={[styles.legendDot, { backgroundColor: colors.bg2, borderColor: colors.borderSoft }]} />
              <Text style={styles.legendText}>Missed</Text>
            </View>
          </View>

          {drawnCount === 0 && !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="moon-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No draws this month</Text>
              <Text style={styles.emptySub}>
                Open the app once each day to weave your journal.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {/* Entry detail modal */}
      <EntryModal
        entry={openEntry}
        onClose={() => setOpenDate(null)}
        onSaved={load}
        router={router}
      />
    </View>
  );
}

// ============ ENTRY MODAL ============
function EntryModal({
  entry, onClose, onSaved, router,
}: {
  entry: DailyEntry | null;
  onClose: () => void;
  onSaved: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedTag, setSavedTag] = useState(false);

  useEffect(() => {
    setText(entry?.reflection || "");
    setSavedTag(!!entry?.reflection);
  }, [entry?.date]);

  if (!entry) return null;

  const save = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      await api.saveReflection(entry.date, text);
      setSavedTag(true);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const pretty = new Date(entry.date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <Modal transparent visible={!!entry} animationType="fade" onRequestClose={onClose}>
      <Pressable style={mstyles.backdrop} onPress={onClose}>
        <Pressable style={mstyles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={mstyles.headerRow}>
            <View>
              <Text style={mstyles.kicker}>{pretty}</Text>
              <Text style={mstyles.name}>{entry.card_name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={mstyles.close} testID="dh-modal-close">
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={mstyles.body}>
            <View style={mstyles.thumb}>
              <Image source={{ uri: imageUri(entry.image_url) }} style={mstyles.img} resizeMode="cover" />
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={mstyles.label}>Reflection</Text>
              <TextInput
                value={text}
                onChangeText={(t) => { setText(t); setSavedTag(false); }}
                placeholder="What did you notice today?"
                placeholderTextColor={colors.textMuted}
                multiline
                style={mstyles.input}
                testID="dh-reflection-input"
              />
              <View style={mstyles.actions}>
                <TouchableOpacity
                  style={[mstyles.actionBtn, { borderColor: colors.gold }]}
                  onPress={() => { onClose(); router.push(`/card/${entry.card_id}`); }}
                  testID="dh-open-card"
                >
                  <Ionicons name="book" size={14} color={colors.gold} />
                  <Text style={[mstyles.actionText, { color: colors.gold }]}>View card</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[mstyles.actionBtn, { backgroundColor: colors.gold, borderColor: colors.gold }]}
                  onPress={save}
                  disabled={saving}
                  testID="dh-save-reflection"
                >
                  {saving ? (
                    <ActivityIndicator color={colors.bg} />
                  ) : (
                    <>
                      <Ionicons name={savedTag ? "checkmark" : "save-outline"} size={14} color={colors.bg} />
                      <Text style={[mstyles.actionText, { color: colors.bg }]}>
                        {savedTag ? "Saved" : "Save"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "flex-start", padding: 12, gap: 6 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginTop: 4 },
  kicker: { color: colors.gold, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  title: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 28, marginTop: 4 },
  scroll: { padding: 20, paddingBottom: 60 },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  navBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  monthLabel: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 22, letterSpacing: 2 },
  yearLabel: { color: colors.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 },
  weekRow: { flexDirection: "row", marginBottom: 8 },
  weekday: {
    flex: 1, textAlign: "center", color: colors.textSecondary, fontSize: 11, letterSpacing: 2,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cellOuter: {
    width: "14.2857%", aspectRatio: 0.72, padding: 3,
  },
  cellEmpty: { width: "14.2857%", aspectRatio: 0.72 },
  cellInner: {
    flex: 1, borderRadius: 8, overflow: "hidden",
    backgroundColor: colors.bg2,
    borderWidth: 1, borderColor: colors.borderSoft,
    position: "relative",
  },
  cellImg: { ...StyleSheet.absoluteFillObject },
  cellDrawn: { borderColor: colors.gold, backgroundColor: colors.surface },
  cellMissed: {},
  cellToday: { borderColor: colors.goldGlow, borderWidth: 2 },
  cellNumWrap: {
    position: "absolute", top: 4, right: 4,
    minWidth: 16, height: 16, paddingHorizontal: 3,
    borderRadius: 8, backgroundColor: "rgba(11,8,26,0.88)",
    alignItems: "center", justifyContent: "center",
  },
  cellNum: { color: colors.textSecondary, fontSize: 9, fontFamily: fonts.body, fontWeight: "700" },
  legend: {
    marginTop: 20, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: colors.borderSoft,
    alignItems: "center",
  },
  legendRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "center" },
  legendDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, marginRight: 6 },
  legendText: { color: colors.textSecondary, fontSize: 11, letterSpacing: 1 },
  emptyBox: { alignItems: "center", gap: 8, paddingVertical: 20 },
  emptyTitle: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 18, letterSpacing: 2 },
  emptySub: { color: colors.textSecondary, fontSize: 13, textAlign: "center", paddingHorizontal: 30 },
});

const mstyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(11,8,26,0.72)", justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, gap: 14, borderTopWidth: 1, borderColor: colors.gold,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  kicker: { color: colors.gold, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  name: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 22, letterSpacing: 2, marginTop: 2 },
  close: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft,
  },
  body: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  thumb: { width: 90, aspectRatio: 0.58, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: colors.gold },
  img: { width: "100%", height: "100%" },
  label: { color: colors.gold, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  input: {
    minHeight: 90, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft,
    borderRadius: 12, padding: 10, color: colors.textPrimary, fontSize: 14,
    textAlignVertical: "top",
  },
  actions: { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
  },
  actionText: { fontSize: 12, letterSpacing: 1.5, fontWeight: "700", textTransform: "uppercase" },
});
