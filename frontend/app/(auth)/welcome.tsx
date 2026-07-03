import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";
import { StarBg } from "@/src/components/StarBg";

const BG = "https://images.unsplash.com/photo-1520034475321-cbe63696469a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwzfHxuaWdodCUyMHNreSUyMHN0YXJzJTIwZ2FsYXh5JTIwZGFya3xlbnwwfHx8fDE3ODE2ODg4NDJ8MA&ixlib=rb-4.1.0&q=85";

export default function Welcome() {
  const router = useRouter();
  return (
    <View style={styles.root} testID="welcome-screen">
      <ImageBackground source={{ uri: BG }} style={StyleSheet.absoluteFill} imageStyle={{ opacity: 0.25 }} />
      <StarBg count={40} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.top}>
          <View style={styles.moonWrap}>
            <Ionicons name="moon" size={56} color={colors.gold} />
          </View>
          <Text style={styles.brand} testID="welcome-brand">MYSTIC XP</Text>
          <Text style={styles.tagline}>
            Master the tarot, one lesson at a time
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/(auth)/signup")}
            testID="welcome-signup-btn"
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Begin Your Journey</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push("/(auth)/login")}
            testID="welcome-login-btn"
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>I already have an account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1, paddingHorizontal: 28, justifyContent: "space-between" },
  top: { flex: 1, alignItems: "center", justifyContent: "center" },
  moonWrap: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
    marginBottom: 28,
  },
  brand: {
    color: colors.gold,
    fontFamily: fonts.display,
    fontSize: 42,
    letterSpacing: 8,
    marginBottom: 14,
  },
  tagline: {
    color: colors.textSecondary,
    fontFamily: fonts.serifItalic,
    fontStyle: "italic",
    fontSize: 17,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 24,
    letterSpacing: 0.4,
  },
  actions: { gap: 14, paddingBottom: 16 },
  primaryBtn: {
    backgroundColor: colors.gold,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
  },
  primaryBtnText: { color: colors.bg, fontSize: 16, fontWeight: "700", fontFamily: fonts.body, letterSpacing: 0.5 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.gold,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
  },
  secondaryBtnText: { color: colors.gold, fontSize: 15, fontFamily: fonts.body },
});
