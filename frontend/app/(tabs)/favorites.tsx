import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";
import { api, Card, imageUri } from "@/src/api/client";
import { StarBg } from "@/src/components/StarBg";

function toRoman(n: number): string {
  if (n === 0) return "0";
  const m: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let o = ""; let v = n; for (const [x, s] of m) { while (v >= x) { o += s; v -= x; } } return o;
}

export default function Favorites() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setCards(await api.listFavorites()); } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  return (
    <View style={styles.root}>
      <StarBg count={20} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={styles.backBtn} testID="fav-back-btn">
            <Ionicons name="chevron-back" size={26} color={colors.gold} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Saved Cards</Text>
            <Text style={styles.title} testID="fav-title">Favorites</Text>
          </View>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
        ) : cards.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyText}>No favorites yet</Text>
            <Text style={styles.emptySub}>Tap the heart on any card to save it here</Text>
          </View>
        ) : (
          <FlatList
            data={cards}
            keyExtractor={(c) => c.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 14 }}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => (
              <TouchableOpacity style={styles.card} activeOpacity={0.85}
                onPress={() => router.push(`/card/${item.id}`)} testID={`fav-card-${index}`}>
                <Image source={{ uri: imageUri(item.image_url) }} style={styles.cardImage} resizeMode="cover" />
                <View style={styles.cardFooter}>
                  <Text style={styles.cardRoman}>{toRoman(item.number)}</Text>
                  <Text style={styles.cardName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
                    {item.name}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingVertical: 14, gap: 6 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginTop: 8 },
  kicker: { color: colors.gold, fontFamily: fonts.display, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  title: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 30, marginTop: 4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  emptyText: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 22, marginTop: 10 },
  emptySub: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, textAlign: "center" },
  list: { padding: 20, gap: 14, paddingBottom: 80 },
  card: { flex: 1, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  cardImage: { width: "100%", aspectRatio: 0.58, backgroundColor: colors.surface2 },
  cardFooter: { paddingVertical: 10, paddingHorizontal: 10, backgroundColor: colors.bg2, alignItems: "center", gap: 2, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  cardRoman: { color: colors.gold, fontFamily: fonts.display, fontSize: 13, letterSpacing: 3 },
  cardName: { color: colors.textPrimary, fontFamily: fonts.display, fontWeight: "700", fontSize: 13, textAlign: "center", letterSpacing: 1.5 },
});
