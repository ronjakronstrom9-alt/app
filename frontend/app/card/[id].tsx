import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";
import { api, Card } from "@/src/api/client";
import { StarBg } from "@/src/components/StarBg";

export default function CardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [card, setCard] = useState<Card | null>(null);
  const [reversed, setReversed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const c = await api.getCard(id);
        setCard(c);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading || !card) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  const meaning = reversed ? card.reversed_meaning : card.upright_meaning;
  const kws = reversed ? card.keywords_reversed : card.keywords_upright;

  return (
    <View style={styles.root}>
      <StarBg count={40} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="card-back-btn">
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{card.arcana} Arcana</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.illustration, reversed && { transform: [{ rotate: "180deg" }] }]}>
            <Text style={styles.emoji}>{card.image_emoji}</Text>
            <Text style={styles.num}>{String(card.number).padStart(2, "0")}</Text>
            <Text style={styles.name}>{card.name}</Text>
          </View>

          <View style={styles.toggle}>
            <TouchableOpacity
              onPress={() => setReversed(false)}
              style={[styles.toggleBtn, !reversed && styles.toggleActive]}
              testID="toggle-upright"
            >
              <Text style={[styles.toggleText, !reversed && styles.toggleTextActive]}>Upright</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setReversed(true)}
              style={[styles.toggleBtn, reversed && styles.toggleActive]}
              testID="toggle-reversed"
            >
              <Text style={[styles.toggleText, reversed && styles.toggleTextActive]}>Reversed</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.kwRow}>
            {kws.map((k) => (
              <View key={k} style={styles.kw}><Text style={styles.kwText}>{k}</Text></View>
            ))}
          </View>

          <Text style={styles.sectionHeading}>Meaning</Text>
          <Text style={styles.body}>{meaning}</Text>

          <Text style={styles.sectionHeading}>Imagery</Text>
          <Text style={styles.body}>{card.description}</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.gold, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  scroll: { padding: 20, paddingBottom: 60, gap: 16 },
  illustration: {
    width: "100%", aspectRatio: 0.7, maxWidth: 280, alignSelf: "center",
    backgroundColor: colors.surface, borderRadius: 22, borderWidth: 2, borderColor: colors.gold,
    alignItems: "center", justifyContent: "center", padding: 18, gap: 10,
  },
  emoji: { fontSize: 90 },
  num: { color: colors.gold, fontFamily: fonts.display, fontSize: 20 },
  name: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 24, textAlign: "center" },
  toggle: {
    flexDirection: "row", backgroundColor: colors.surface, borderRadius: 999,
    padding: 4, borderWidth: 1, borderColor: colors.borderSoft, marginTop: 8,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 999 },
  toggleActive: { backgroundColor: colors.gold },
  toggleText: { color: colors.textSecondary, fontSize: 13, letterSpacing: 1, textTransform: "uppercase" },
  toggleTextActive: { color: colors.bg, fontWeight: "700" },
  kwRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  kw: { borderWidth: 1, borderColor: colors.gold, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  kwText: { color: colors.gold, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  sectionHeading: { color: colors.gold, fontFamily: fonts.display, fontSize: 20, marginTop: 10 },
  body: { color: colors.textPrimary, fontSize: 15, lineHeight: 24 },
});
