import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";
import { api, imageUri } from "@/src/api/client";

export function DailyCardWidget() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.dailyCard().then(setData).catch(() => {});
  }, []);

  if (!data?.card) return null;
  const c = data.card;

  return (
    <View style={styles.wrap} testID="daily-card-widget">
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push(`/card/${c.id}?date=${data.date}`)}
        style={styles.mainBtn}
      >
        <View style={styles.left}>
          <Text style={styles.kicker}>✦  Card of the Day  ✦</Text>
          <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {c.name}
          </Text>
          <Text style={styles.prompt} numberOfLines={3}>{data.prompt}</Text>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>Reflect</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.gold} />
          </View>
        </View>
        <View style={styles.thumb}>
          <Image source={{ uri: imageUri(c.image_url) }} style={styles.img} resizeMode="cover" />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.historyBtn}
        onPress={() => router.push("/daily-history")}
        activeOpacity={0.8}
        testID="daily-history-link"
      >
        <Ionicons name="calendar-outline" size={14} color={colors.gold} />
        <Text style={styles.historyText}>View journal</Text>
        <Ionicons name="chevron-forward" size={12} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20, marginBottom: 12,
    borderRadius: 18, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.gold,
    overflow: "hidden",
  },
  mainBtn: { flexDirection: "row", gap: 12, padding: 12 },
  historyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 10, paddingHorizontal: 14,
    borderTopWidth: 1, borderTopColor: colors.borderSoft,
    backgroundColor: colors.surface2,
  },
  historyText: { color: colors.gold, fontFamily: fonts.display, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", flex: 1 },
  left: { flex: 1, justifyContent: "space-between", gap: 6 },
  kicker: { color: colors.gold, fontFamily: fonts.display, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" },
  name: { color: colors.textPrimary, fontFamily: fonts.display, fontWeight: "700", fontSize: 18, letterSpacing: 1 },
  prompt: { color: colors.textSecondary, fontFamily: fonts.serifItalic, fontStyle: "italic", fontSize: 13, lineHeight: 18 },
  cta: { flexDirection: "row", alignItems: "center", gap: 4 },
  ctaText: { color: colors.gold, fontFamily: fonts.display, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  thumb: { width: 78, aspectRatio: 0.58, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  img: { width: "100%", height: "100%" },
});
