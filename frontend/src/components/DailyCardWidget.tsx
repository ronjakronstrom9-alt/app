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
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => router.push(`/card/${c.id}`)}
      style={styles.wrap}
      testID="daily-card-widget"
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
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row", gap: 12, padding: 12,
    marginHorizontal: 20, marginBottom: 12,
    borderRadius: 18, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.gold,
  },
  left: { flex: 1, justifyContent: "space-between", gap: 6 },
  kicker: { color: colors.gold, fontFamily: fonts.display, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" },
  name: { color: colors.textPrimary, fontFamily: fonts.display, fontWeight: "700", fontSize: 18, letterSpacing: 1 },
  prompt: { color: colors.textSecondary, fontFamily: fonts.serifItalic, fontStyle: "italic", fontSize: 13, lineHeight: 18 },
  cta: { flexDirection: "row", alignItems: "center", gap: 4 },
  ctaText: { color: colors.gold, fontFamily: fonts.display, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  thumb: { width: 78, aspectRatio: 0.58, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  img: { width: "100%", height: "100%" },
});
