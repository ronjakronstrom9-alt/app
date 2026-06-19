import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";
import { api, Card } from "@/src/api/client";
import { StarBg } from "@/src/components/StarBg";

function toRoman(n: number): string {
  if (n === 0) return "0";
  const map: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = ""; let v = n;
  for (const [val, sym] of map) {
    while (v >= val) { out += sym; v -= val; }
  }
  return out;
}

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
          <Text style={styles.headerTitle}>{card.arcana} Arcana · {card.element}</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.cardFrame}>
            <View style={[styles.cardImageWrap, reversed && { transform: [{ rotate: "180deg" }] }]}>
              <Image source={{ uri: card.image_url }} style={styles.cardImage} resizeMode="cover" />
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.cardRoman}>{toRoman(card.number)}</Text>
              <Text style={styles.cardName}>{card.name.toUpperCase()}</Text>
            </View>
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
          <View style={styles.divider} />
          <Text style={styles.body}>{meaning}</Text>

          {!reversed && (
            <>
              <Text style={styles.sectionHeading}>Imagery & Symbolism</Text>
              <View style={styles.divider} />
              <Text style={styles.body}>{card.description}</Text>
              <Text style={[styles.body, { marginTop: 8 }]}>{card.symbolism}</Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.gold, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  scroll: { padding: 20, paddingBottom: 60, gap: 14 },
  cardFrame: {
    width: "100%", maxWidth: 240, alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: 18, borderWidth: 2, borderColor: colors.gold,
    overflow: "hidden",
  },
  cardImageWrap: { width: "100%", aspectRatio: 0.58, backgroundColor: colors.surface2 },
  cardImage: { width: "100%", height: "100%" },
  cardFooter: {
    paddingVertical: 10, backgroundColor: colors.bg2,
    borderTopWidth: 1, borderTopColor: colors.borderSoft,
    alignItems: "center", gap: 2,
  },
  cardRoman: { color: colors.gold, fontFamily: fonts.display, fontSize: 14, letterSpacing: 4 },
  cardName: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 13, letterSpacing: 3 },
  toggle: {
    flexDirection: "row", backgroundColor: colors.surface, borderRadius: 999,
    padding: 4, borderWidth: 1, borderColor: colors.borderSoft, marginTop: 6,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 999 },
  toggleActive: { backgroundColor: colors.gold },
  toggleText: { color: colors.textSecondary, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" },
  toggleTextActive: { color: colors.bg, fontWeight: "700" },
  kwRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  kw: { borderWidth: 1, borderColor: colors.gold, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  kwText: { color: colors.gold, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  sectionHeading: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 24, marginTop: 12 },
  divider: { height: 1, backgroundColor: colors.border, width: 50 },
  body: { color: colors.textPrimary, fontSize: 15, lineHeight: 24 },
});
