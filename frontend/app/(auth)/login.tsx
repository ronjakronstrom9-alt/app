import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";
import { useAuth } from "@/src/context/auth";
import { StarBg } from "@/src/components/StarBg";

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    setErr(null);
    if (!email || !password) {
      setErr("Please enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e?.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <StarBg count={20} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <TouchableOpacity onPress={() => router.back()} testID="login-back-btn" style={styles.back}>
              <Ionicons name="chevron-back" size={26} color={colors.gold} />
            </TouchableOpacity>

            <View style={styles.header}>
              <Ionicons name="moon" size={40} color={colors.gold} />
              <Text style={styles.title} testID="login-title">Welcome Back, Seeker</Text>
              <Text style={styles.sub}>The cards have been waiting for you</Text>
            </View>

            <View style={styles.form}>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="seeker@mystic.app"
                keyboardType="email-address"
                testID="login-email-input"
                autoCapitalize="none"
              />
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Your secret"
                secureTextEntry
                testID="login-password-input"
              />

              {err && <Text style={styles.err} testID="login-error">{err}</Text>}

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={onSubmit}
                disabled={busy}
                testID="login-submit-btn"
                activeOpacity={0.85}
              >
                {busy ? (
                  <ActivityIndicator color={colors.bg} />
                ) : (
                  <Text style={styles.primaryBtnText}>Enter the Realm</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.replace("/(auth)/signup")} testID="login-to-signup-btn">
                <Text style={styles.linkText}>
                  No account? <Text style={{ color: colors.gold }}>Create one</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Field(props: any) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{props.label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.textMuted}
        style={fieldStyles.input}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: colors.textSecondary, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "System" },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 16,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 24, flexGrow: 1, gap: 24 },
  back: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  header: { alignItems: "center", marginTop: 8, gap: 10 },
  title: { color: colors.textPrimary, fontFamily: fonts.display, fontSize: 28, letterSpacing: 1, textAlign: "center" },
  sub: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14 },
  form: { gap: 16, marginTop: 8 },
  primaryBtn: {
    backgroundColor: colors.gold,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnText: { color: colors.bg, fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
  linkText: { color: colors.textSecondary, textAlign: "center", marginTop: 4, fontSize: 14 },
  err: { color: colors.crimson, fontSize: 13, textAlign: "center" },
});
