import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fonts } from "@/src/theme";
import { useAuth } from "@/src/context/auth";
import { StarBg } from "@/src/components/StarBg";

const TITLES = ["Seeker", "Acolyte", "Initiate", "Adept", "Mystic", "Oracle", "Sage", "Visionary", "Magus", "Arcanum"];

export default function Profile() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  if (!user) return null;

  const title = TITLES[Math.min(user.level - 1, TITLES.length - 1)];

  const logout = async () => {
    await signOut();
    router.replace("/(auth)/welcome");
  };

  return (
    <View style={styles.root}>
      <StarBg count={40} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Ionicons name="moon" size={56} color={colors.gold} />
            </View>
            <Text style={styles.name} testID="profile-name">{user.name}</Text>
            <Text style={styles.email}>{user.email}</Text>
            <View style={styles.badge}>
              <Ionicons name="star" size={14} color={colors.bg} />
              <Text style={styles.badgeText}>Level {user.level} · {title}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <SmallStat label="XP" value={user.xp} icon="star" color={colors.goldGlow} />
            <SmallStat label="Streak" value={user.streak} icon="flame" color={colors.gold} />
            <SmallStat label="Lessons" value={user.completed_lessons.length} icon="checkmark-done" color={colors.green} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <Row icon="mail" label="Email" value={user.email} />
            <Row icon="calendar" label="Member since" value={new Date(user.created_at).toLocaleDateString()} />
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={logout} testID="logout-btn" activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={18} color={colors.crimson} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SmallStat({ label, value, icon, color }: any) {
  return (
    <View style={styles.smallStat}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.smallStatValue, { color }]}>{value}</Text>
      <Text style={styles.smallStatLabel}>{label}</Text>
    </View>
  );
}

function Row({ icon, label, value }: any) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.gold} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 100, gap: 22 },
  avatarWrap: { alignItems: "center", gap: 8, marginTop: 8 },
  avatar: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.gold,
  },
  name: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 26, marginTop: 8 },
  email: { color: colors.textSecondary, fontSize: 13 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.gold, paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 999, marginTop: 8,
  },
  badgeText: { color: colors.bg, fontWeight: "700", fontSize: 12, letterSpacing: 0.6 },
  statsRow: { flexDirection: "row", gap: 10 },
  smallStat: {
    flex: 1, backgroundColor: colors.surface, padding: 14, borderRadius: 16,
    alignItems: "center", borderWidth: 1, borderColor: colors.borderSoft, gap: 4,
  },
  smallStatValue: { fontFamily: fonts.display, fontSize: 22 },
  smallStatLabel: { color: colors.textSecondary, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  section: { backgroundColor: colors.surface, borderRadius: 18, padding: 16, gap: 14, borderWidth: 1, borderColor: colors.borderSoft },
  sectionTitle: { color: colors.gold, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  rowLabel: { color: colors.textSecondary, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  rowValue: { color: colors.textPrimary, fontSize: 15, marginTop: 2 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.crimson,
  },
  logoutText: { color: colors.crimson, fontWeight: "700", fontSize: 15 },
});
