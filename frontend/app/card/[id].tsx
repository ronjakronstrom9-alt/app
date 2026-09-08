import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { colors, fonts } from "@/src/theme";
import { api, Card, imageUri } from "@/src/api/client";
import { StarBg } from "@/src/components/StarBg";
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

export default function CardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [card, setCard] = useState<Card | null>(null);
  const [reversed, setReversed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(true);

  const isFav = !!user && !!card && user.favorites?.includes(card.id);

  useEffect(() => {
    (async () => {
      try {
        const c = await api.getCard(id);
        setCard(c);
        const n = await api.getNote(id).catch(() => ({ text: "" }));
        setNote(n.text || "");
      } finally { setLoading(false); }
    })();
  }, [id]);

  const toggleFav = async () => {
    if (!card) return;
    await api.toggleFavorite(card.id);
    await refresh();
  };

  const saveNote = async () => {
    if (!card) return;
    setNoteSaved(false);
    await api.saveNote(card.id, note);
    setNoteSaved(true);
  };

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
      <StarBg count={20} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="card-back-btn">
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{card.arcana} Arcana · {card.element}</Text>
          <TouchableOpacity onPress={toggleFav} style={styles.iconBtn} testID="card-fav-btn">
            <Ionicons name={isFav ? "heart" : "heart-outline"} size={26} color={isFav ? colors.crimson : colors.gold} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <FlipCard
            imageUrl={card.image_url}
            reversed={reversed}
            onFlip={() => setReversed((r) => !r)}
          />

          <View style={styles.nameBlock}>
            <Text style={styles.cardRoman}>{toRoman(card.number)}</Text>
            <Text style={styles.cardName}>{card.name.toUpperCase()}</Text>
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

          <Text style={styles.sectionHeading}>My Notes</Text>
          <View style={styles.divider} />
          <TextInput
            value={note}
            onChangeText={(t) => { setNote(t); setNoteSaved(false); }}
            onBlur={saveNote}
            placeholder="Write your own interpretation..."
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.noteInput}
            testID="card-note-input"
          />
          <TouchableOpacity onPress={saveNote} style={styles.noteSave} testID="card-note-save">
            <Text style={styles.noteSaveText}>{noteSaved ? "✓ Saved" : "Save note"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ============ FLIP CARD ============
function FlipCard({
  imageUrl, reversed, onFlip,
}: { imageUrl: string; reversed: boolean; onFlip: () => void }) {
  const flip = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    flip.value = withTiming(reversed ? 1 : 0, { duration: 700, easing: Easing.inOut(Easing.cubic) });
  }, [reversed]);

  useEffect(() => {
    glow.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, []);

  const frontStyle = useAnimatedStyle(() => {
    // Front (upright) face — 0° -> 180°, hidden past 90°
    const rot = interpolate(flip.value, [0, 1], [0, 180]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rot}deg` }],
      opacity: flip.value < 0.5 ? 1 : 0,
      backfaceVisibility: "hidden" as const,
    };
  });

  const backStyle = useAnimatedStyle(() => {
    // Back (reversed) face — mirrored initial 180° and rotates to 360°
    // Also flipped vertically inside a wrapper so the illustration reads upside-down
    const rot = interpolate(flip.value, [0, 1], [180, 360]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rot}deg` }],
      opacity: flip.value > 0.5 ? 1 : 0,
      backfaceVisibility: "hidden" as const,
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.15 + glow.value * 0.3,
    transform: [{ scale: 1 + glow.value * 0.02 }],
  }));

  return (
    <View style={flipStyles.wrap}>
      <Animated.View style={[flipStyles.glow, glowStyle]} />
      <TouchableOpacity activeOpacity={0.9} onPress={onFlip} testID="flip-card">
        <View style={flipStyles.stage}>
          <Animated.View style={[flipStyles.face, frontStyle]}>
            <Image source={{ uri: imageUri(imageUrl) }} style={flipStyles.image} resizeMode="cover" />
            <View style={flipStyles.tag}>
              <Ionicons name="arrow-up" size={12} color={colors.gold} />
              <Text style={flipStyles.tagText}>UPRIGHT</Text>
            </View>
          </Animated.View>

          <Animated.View style={[flipStyles.face, backStyle, StyleSheet.absoluteFillObject]}>
            <View style={flipStyles.inner180}>
              <Image source={{ uri: imageUri(imageUrl) }} style={flipStyles.image} resizeMode="cover" />
            </View>
            <View style={flipStyles.tag}>
              <Ionicons name="arrow-down" size={12} color={colors.gold} />
              <Text style={flipStyles.tagText}>REVERSED</Text>
            </View>
          </Animated.View>
        </View>
      </TouchableOpacity>
      <Text style={flipStyles.hint}>tap card to flip · {reversed ? "reversed" : "upright"}</Text>
    </View>
  );
}

const flipStyles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 10, marginTop: 4 },
  glow: {
    position: "absolute",
    top: 6, left: 24, right: 24, bottom: 40,
    borderRadius: 20,
    backgroundColor: "rgba(212,175,55,0.20)",
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 30,
    elevation: 12,
  },
  stage: {
    width: 200, aspectRatio: 0.58, borderRadius: 16,
    overflow: "hidden",
  },
  face: {
    width: "100%", height: "100%",
    borderRadius: 16, overflow: "hidden",
    borderWidth: 2, borderColor: colors.gold,
    backgroundColor: colors.surface2,
  },
  inner180: { width: "100%", height: "100%", transform: [{ rotate: "180deg" }] },
  image: { width: "100%", height: "100%" },
  tag: {
    position: "absolute", top: 8, left: 8,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(11,8,26,0.8)",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    borderWidth: 1, borderColor: colors.gold,
  },
  tagText: { color: colors.gold, fontSize: 9, letterSpacing: 1.5, fontWeight: "700" },
  hint: { color: colors.textSecondary, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.gold, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  scroll: { padding: 20, paddingBottom: 60, gap: 14 },
  cardFrame: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 2, borderColor: colors.gold,
    overflow: "hidden",
  },
  dualFrame: { flexDirection: "row", gap: 12 },
  orientationCol: { flex: 1, alignItems: "center", gap: 6 },
  orientationLabel: { color: colors.gold, fontFamily: fonts.display, fontWeight: "700", fontSize: 11, letterSpacing: 2.5 },
  nameBlock: { alignItems: "center", gap: 4, marginTop: 10 },
  cardImageWrap: { width: "100%", aspectRatio: 0.58, backgroundColor: colors.surface2 },
  cardImage: { width: "100%", height: "100%" },
  cardFooter: {
    paddingVertical: 10, backgroundColor: colors.bg2,
    borderTopWidth: 1, borderTopColor: colors.borderSoft,
    alignItems: "center", gap: 2,
  },
  cardRoman: { color: colors.gold, fontFamily: fonts.display, fontWeight: "700", fontSize: 18, letterSpacing: 4 },
  cardName: { color: colors.textPrimary, fontFamily: fonts.display, fontWeight: "700", fontSize: 18, letterSpacing: 4 },
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
  sectionHeading: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 26, lineHeight: 32, marginTop: 12, letterSpacing: 0.3 },
  divider: { height: 1, backgroundColor: colors.border, width: 50 },
  body: { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 15, lineHeight: 24, letterSpacing: 0.2 },
  noteInput: {
    minHeight: 100, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft,
    borderRadius: 14, padding: 14, color: colors.textPrimary, fontFamily: fonts.body, fontSize: 15,
    textAlignVertical: "top",
  },
  noteSave: {
    alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1, borderColor: colors.gold,
  },
  noteSaveText: { color: colors.gold, fontFamily: fonts.display, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
});
