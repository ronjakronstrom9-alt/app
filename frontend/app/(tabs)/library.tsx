import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image,
  TextInput, ScrollView, Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";
import { api, Card, imageUri } from "@/src/api/client";
import { StarBg } from "@/src/components/StarBg";
import { InfoButton } from "@/src/components/GlossaryModal";
import { useAuth } from "@/src/context/auth";

function toRoman(n: number): string {
  if (n === 0) return "0";
  const map: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = ""; let v = n;
  for (const [val, sym] of map) {
    while (v >= val) { out += sym; v -= val; }
  }
  return out;
}

type FilterKey = "all" | "Major" | "Wands" | "Cups" | "Swords" | "Pentacles";
const FILTERS: { key: FilterKey; label: string; icon: any }[] = [
  { key: "all", label: "All", icon: "grid" },
  { key: "Major", label: "Major", icon: "star" },
  { key: "Wands", label: "Wands", icon: "flame" },
  { key: "Cups", label: "Cups", icon: "water" },
  { key: "Swords", label: "Swords", icon: "flash" },
  { key: "Pentacles", label: "Pentacles", icon: "planet" },
];

export default function Library() {
  const router = useRouter();
  const { user } = useAuth();
  const knownIds = useMemo(() => new Set(user?.known_cards || []), [user?.known_cards]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => {
      if (filter === "Major" && c.arcana !== "Major") return false;
      if (filter !== "all" && filter !== "Major" && c.suit !== filter) return false;
      if (!q) return true;
      if (c.name.toLowerCase().includes(q)) return true;
      if ((c.element || "").toLowerCase().includes(q)) return true;
      if ((c.suit || "").toLowerCase().includes(q)) return true;
      const kws = [...(c.keywords_upright || []), ...(c.keywords_reversed || [])];
      return kws.some((k) => k.toLowerCase().includes(q));
    });
  }, [cards, query, filter]);

  const activeFilterLabel = FILTERS.find((f) => f.key === filter)?.label || "All";

  return (
    <View style={styles.root}>
      <StarBg count={20} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={styles.backBtn} testID="library-back-btn">
            <Ionicons name="chevron-back" size={26} color={colors.gold} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.kicker}>The Library</Text>
              <InfoButton highlight="Major Arcana" />
            </View>
            <Text style={styles.title} testID="library-title">Tarot Cards</Text>
            <Text style={styles.sub}>
              {loading ? "Loading the deck…" : `${filtered.length} of ${cards.length} · ${activeFilterLabel}`}
            </Text>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, keyword or element…"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              testID="library-search-input"
            />
            {query.length > 0 ? (
              <TouchableOpacity
                onPress={() => { setQuery(""); Keyboard.dismiss(); }}
                testID="library-search-clear"
                hitSlop={10}
              >
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.85}
                style={[styles.chip, active && styles.chipActive]}
                testID={`library-filter-${f.key}`}
              >
                <Ionicons name={f.icon} size={13} color={active ? colors.bg : colors.gold} />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox} testID="library-empty">
            <Ionicons name="moon-outline" size={54} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No cards found</Text>
            <Text style={styles.emptySub}>
              Try a different keyword or clear the filters.
            </Text>
            <TouchableOpacity
              onPress={() => { setQuery(""); setFilter("all"); }}
              style={styles.emptyBtn}
              testID="library-empty-reset"
            >
              <Text style={styles.emptyBtnText}>Reset search</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 14 }}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => router.push(`/card/${item.id}`)}
                testID={`card-${index}`}
              >
                <View style={styles.imageWrap}>
                  <Image source={{ uri: imageUri(item.image_url) }} style={styles.cardImage} resizeMode="cover" />
                  {knownIds.has(item.id) && (
                    <View style={styles.knownBadge} pointerEvents="none">
                      <Ionicons name="checkmark" size={11} color={colors.bg} />
                    </View>
                  )}
                  <View style={styles.overlay} pointerEvents="none">
                    <Text
                      style={styles.overlayName}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.6}
                    >
                      {item.name}
                    </Text>
                    <Text style={styles.overlayKw} numberOfLines={1}>
                      {(item.keywords_upright?.slice(0, 2) || []).join(" · ")}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardRoman}>{toRoman(item.number)}</Text>
                  <Text
                    style={styles.cardName}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.55}
                  >
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
  kicker: { color: colors.gold, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  title: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 30, marginTop: 4 },
  sub: { color: colors.textSecondary, fontSize: 14, marginTop: 4 },
  searchWrap: { paddingHorizontal: 20, marginTop: 4 },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 16,
    borderWidth: 1, borderColor: colors.borderSoft, minHeight: 46,
  },
  searchInput: {
    flex: 1, color: colors.textPrimary, fontFamily: fonts.body, fontSize: 15,
    paddingVertical: 10,
  },
  chipRow: { paddingHorizontal: 20, paddingVertical: 14, gap: 8, alignItems: "center" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.gold,
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.gold, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: "700" },
  chipTextActive: { color: colors.bg },
  emptyBox: { alignItems: "center", paddingHorizontal: 30, paddingTop: 60, gap: 10 },
  emptyTitle: {
    color: colors.textPrimary, fontFamily: fonts.display, fontSize: 22, letterSpacing: 2,
    marginTop: 8,
  },
  emptySub: { color: colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyBtn: {
    marginTop: 14, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 999, borderWidth: 1, borderColor: colors.gold,
  },
  emptyBtnText: { color: colors.gold, fontSize: 12, letterSpacing: 2, fontWeight: "700", textTransform: "uppercase" },
  list: { padding: 20, gap: 14, paddingBottom: 80 },
  card: {
    flex: 1, borderRadius: 16, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  imageWrap: { position: "relative", width: "100%", aspectRatio: 0.58, backgroundColor: colors.surface2 },
  knownBadge: {
    position: "absolute", top: 6, right: 6, zIndex: 1,
    width: 20, height: 20, borderRadius: 10, backgroundColor: colors.green,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: colors.bg,
  },
  cardImage: { width: "100%", height: "100%" },
  overlay: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: 8, paddingVertical: 8,
    backgroundColor: "rgba(11,8,26,0.78)",
    borderTopWidth: 1, borderTopColor: "rgba(212,175,55,0.35)",
    alignItems: "center", gap: 2,
  },
  overlayName: {
    color: colors.goldGlow, fontFamily: fonts.display, fontWeight: "700",
    fontSize: 12, letterSpacing: 1.5, textAlign: "center", textTransform: "uppercase",
    maxWidth: "100%",
  },
  overlayKw: {
    color: colors.textPrimary, fontFamily: fonts.body, fontSize: 9, letterSpacing: 1,
    textTransform: "uppercase", opacity: 0.9, textAlign: "center", maxWidth: "100%",
  },
  cardFooter: {
    paddingVertical: 10, paddingHorizontal: 10, backgroundColor: colors.bg2,
    alignItems: "center", gap: 2, borderTopWidth: 1, borderTopColor: colors.borderSoft,
  },
  cardRoman: { color: colors.gold, fontFamily: fonts.display, fontSize: 13, letterSpacing: 3 },
  cardName: {
    color: colors.textPrimary, fontFamily: fonts.display, fontWeight: "700",
    fontSize: 13, textAlign: "center", letterSpacing: 1.5,
  },
});
