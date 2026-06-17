import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fonts } from "@/src/theme";
import { api, Card } from "@/src/api/client";
import { StarBg } from "@/src/components/StarBg";

export default function Library() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const cs = await api.listCards();
        setCards(cs);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <View style={styles.root}>
      <StarBg count={40} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.kicker}>The Library</Text>
          <Text style={styles.title} testID="library-title">Tarot Cards</Text>
          <Text style={styles.sub}>Study the Major Arcana</Text>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={cards}
            keyExtractor={(c) => c.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 14 }}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => router.push(`/card/${item.id}`)}
                testID={`card-${index}`}
              >
                <View style={styles.cardInner}>
                  <Text style={styles.cardNum}>{String(item.number).padStart(2, "0")}</Text>
                  <Text style={styles.cardEmoji}>{item.image_emoji}</Text>
                  <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.cardKw} numberOfLines={1}>{item.keywords_upright[0]}</Text>
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
  header: { paddingHorizontal: 20, paddingVertical: 14 },
  kicker: { color: colors.gold, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  title: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 30, marginTop: 4 },
  sub: { color: colors.textSecondary, fontSize: 14, marginTop: 4 },
  list: { padding: 20, gap: 14, paddingBottom: 80 },
  card: {
    flex: 1,
    aspectRatio: 0.72,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    overflow: "hidden",
  },
  cardInner: { flex: 1, padding: 14, alignItems: "center", justifyContent: "space-between" },
  cardNum: { color: colors.gold, fontFamily: fonts.display, fontSize: 18, alignSelf: "flex-start" },
  cardEmoji: { fontSize: 64 },
  cardName: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 16, textAlign: "center" },
  cardKw: { color: colors.textSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2 },
});
