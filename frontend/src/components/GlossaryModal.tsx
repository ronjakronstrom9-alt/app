import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";

export const GLOSSARY: { term: string; definition: string }[] = [
  {
    term: "Major Arcana",
    definition: "22 cards representing big life themes and turning points — cards like The Fool, Death, or The Sun.",
  },
  {
    term: "Minor Arcana",
    definition: "56 cards across 4 suits (Wands, Cups, Swords, Pentacles) that reflect everyday situations and experiences.",
  },
  {
    term: "Upright",
    definition: "A card drawn the right way up. Its meaning applies in its clearest, most direct form.",
  },
  {
    term: "Reversed",
    definition: "A card drawn upside-down. Its meaning is usually blocked, delayed, or turned inward — not automatically \"bad\".",
  },
  {
    term: "Card Combinations",
    definition: "Reading two or more cards together, where their individual meanings blend into one combined message.",
  },
  {
    term: "Tarot Reading",
    definition: "Interpreting one or more drawn cards in the context of a specific question or situation you're exploring.",
  },
];

export function GlossaryModal({
  visible, onClose, highlight,
}: { visible: boolean; onClose: () => void; highlight?: string }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Tarot Basics</Text>
            <TouchableOpacity onPress={onClose} style={styles.close} testID="glossary-close">
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {GLOSSARY.map((g) => (
              <View
                key={g.term}
                style={[styles.row, highlight === g.term && styles.rowHighlight]}
                testID={`glossary-term-${g.term}`}
              >
                <Text style={styles.term}>{g.term}</Text>
                <Text style={styles.def}>{g.definition}</Text>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** A small "?" button that opens the glossary, optionally highlighting one term. */
export function InfoButton({ highlight, size = 16 }: { highlight?: string; size?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        hitSlop={10}
        style={styles.infoBtn}
        testID={`info-btn-${highlight ? highlight.replace(/\s+/g, "-").toLowerCase() : "general"}`}
      >
        <Ionicons name="help-circle-outline" size={size} color={colors.gold} />
      </TouchableOpacity>
      <GlossaryModal visible={open} onClose={() => setOpen(false)} highlight={highlight} />
    </>
  );
}

const styles = StyleSheet.create({
  infoBtn: { padding: 2 },
  backdrop: { flex: 1, backgroundColor: "rgba(11,8,26,0.72)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 34, gap: 14, borderTopWidth: 1, borderColor: colors.gold,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 20, letterSpacing: 2 },
  close: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft,
  },
  row: {
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, gap: 4,
  },
  rowHighlight: {
    backgroundColor: colors.surface, borderRadius: 12, borderBottomWidth: 0,
    paddingHorizontal: 10, borderWidth: 1, borderColor: colors.gold,
  },
  term: { color: colors.gold, fontFamily: fonts.display, fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase" },
  def: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 2 },
});
