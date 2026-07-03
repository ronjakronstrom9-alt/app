import React, { useMemo } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { colors } from "@/src/theme";

type Star = { x: number; y: number; size: number; opacity: number };

// Memoize stars per screen size, computed once at module load. Reduces
// re-render cost of decorative background across screen transitions.
const { width: _W, height: _H } = Dimensions.get("window");

function makeStars(count: number): Star[] {
  const arr: Star[] = [];
  for (let i = 0; i < count; i++) {
    arr.push({
      x: Math.random() * _W,
      y: Math.random() * (_H + 200),
      size: Math.random() * 2.5 + 0.5,
      opacity: Math.random() * 0.6 + 0.2,
    });
  }
  return arr;
}

const _cache = new Map<number, Star[]>();

function StarBgImpl({ count = 30 }: { count?: number }) {
  const stars = useMemo<Star[]>(() => {
    let s = _cache.get(count);
    if (!s) { s = makeStars(count); _cache.set(count, s); }
    return s;
  }, [count]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { pointerEvents: "none" as any }]}>
      {stars.map((s, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            backgroundColor: i % 7 === 0 ? colors.gold : "#FFFFFF",
            opacity: s.opacity,
          }}
        />
      ))}
    </View>
  );
}

export const StarBg = React.memo(StarBgImpl);
