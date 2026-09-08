import React, { useEffect, useMemo } from "react";
import { StyleSheet, View, Text, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "@/src/theme";

type Props = { visible: boolean; count?: number };

/**
 * Ambient celebration layer: rotating star burst behind content + a swarm of
 * gently-drifting particles. Renders fixed-position and pointerEvents="none",
 * so it never interferes with underlying UI.
 */
export function XpCelebration({ visible, count = 18 }: Props) {
  const { colors } = useTheme();
  const rot = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    rot.value = withRepeat(withTiming(360, { duration: 22000, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [visible]);

  const burstStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }, { scale: 1 + pulse.value * 0.05 }],
    opacity: 0.15 + pulse.value * 0.2,
  }));

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.burst, burstStyle]}>
        <Ionicons name="sparkles" size={520} color={colors.gold} />
      </Animated.View>
      <Particles count={count} color={colors.goldGlow} />
    </View>
  );
}

function Particles({ count, color }: { count: number; color: string }) {
  const { width, height } = Dimensions.get("window");
  const items = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 4 + Math.random() * 8,
        delay: Math.random() * 1200,
        dur: 1600 + Math.random() * 1400,
        drift: -30 - Math.random() * 60,
      })),
    [count, width, height],
  );
  return (
    <>
      {items.map((p, i) => (
        <Particle key={i} {...p} color={color} />
      ))}
    </>
  );
}

function Particle({
  x, y, size, delay, dur, drift, color,
}: { x: number; y: number; size: number; delay: number; dur: number; drift: number; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.quad) }), -1, false),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: x - size / 2,
    top: y - size / 2 + interpolate(t.value, [0, 1], [0, drift]),
    width: size,
    height: size,
    opacity: interpolate(t.value, [0, 0.15, 0.85, 1], [0, 1, 1, 0]),
    transform: [{ scale: interpolate(t.value, [0, 0.5, 1], [0.6, 1.2, 0.4]) }],
  }));

  return (
    <Animated.View style={style}>
      <Ionicons name="star" size={size} color={color} />
    </Animated.View>
  );
}

/** Animated numeric counter with easing — fires whenever `to` changes. */
export function AnimatedNumber({
  to,
  duration = 900,
  style,
  prefix = "",
  testID,
}: {
  to: number;
  duration?: number;
  style?: any;
  prefix?: string;
  testID?: string;
}) {
  const value = useSharedValue(0);
  const [display, setDisplay] = React.useState(0);

  useEffect(() => {
    value.value = withTiming(to, { duration, easing: Easing.out(Easing.cubic) });
  }, [to]);

  useEffect(() => {
    const id = setInterval(() => setDisplay(Math.round(value.value)), 40);
    return () => clearInterval(id);
  }, []);

  return (
    <Text style={style} testID={testID}>
      {prefix}
      {display}
    </Text>
  );
}

/** Streak badge with warm glow animation. */
export function StreakBadge({ streak, bonus }: { streak: number; bonus?: number }) {
  const { colors } = useTheme();
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + glow.value * 0.4,
    transform: [{ scale: 1 + glow.value * 0.06 }],
  }));

  return (
    <View style={styles.streakWrap}>
      <Animated.View
        style={[
          styles.streakGlow,
          glowStyle,
          { shadowColor: colors.gold, backgroundColor: "rgba(212,175,55,0.15)" },
        ]}
      />
      <View style={[styles.streakBadge, { borderColor: colors.gold, backgroundColor: colors.surface }]}>
        <Ionicons name="flame" size={26} color={colors.gold} />
        <Text style={[styles.streakNum, { color: colors.gold, fontFamily: fonts.display }]}>{streak}</Text>
        <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>DAY STREAK</Text>
        {bonus ? (
          <View style={[styles.bonusPill, { borderColor: colors.gold, backgroundColor: colors.gold }]}>
            <Ionicons name="add" size={10} color={colors.bg} />
            <Text style={[styles.bonusText, { color: colors.bg }]}>{bonus} XP</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  burst: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -260,
    marginLeft: -260,
  },
  streakWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  streakGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    margin: 10,
  },
  streakBadge: {
    paddingVertical: 14, paddingHorizontal: 22,
    borderRadius: 22, borderWidth: 1,
    alignItems: "center", gap: 4, minWidth: 140,
  },
  streakNum: { fontSize: 34, letterSpacing: 2 },
  streakLabel: { fontSize: 10, letterSpacing: 2 },
  bonusPill: {
    flexDirection: "row", alignItems: "center", gap: 2,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    borderWidth: 1, marginTop: 4,
  },
  bonusText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
});
