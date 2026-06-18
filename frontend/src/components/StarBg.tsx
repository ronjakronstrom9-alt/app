import React, { useMemo } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { colors } from "@/src/theme";

type Star = { x: number; y: number; size: number; opacity: number };

export function StarBg({ count = 60 }: { count?: number }) {
  const { width, height } = Dimensions.get("window");
  const stars = useMemo<Star[]>(() => {
    const arr: Star[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: Math.random() * width,
        y: Math.random() * (height + 200),
        size: Math.random() * 2.5 + 0.5,
        opacity: Math.random() * 0.6 + 0.2,
      });
    }
    return arr;
  }, [count, width, height]);

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
