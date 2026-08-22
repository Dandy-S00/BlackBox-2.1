/**
 * PixelWarning — an 8-bit style animated warning sign drawn entirely with
 * React Native <View> blocks (no SVG, no images). It pulses to catch attention.
 *
 * Usage:
 *   <PixelWarning />                         — default amber, medium size
 *   <PixelWarning size={32} color="#E36D77" /> — custom size / colour
 *
 * ValidationError — a red-highlighted inline error banner that pairs the
 * PixelWarning icon with a human-readable message.
 *
 *   <ValidationError message="Choose a workspace before saving." />
 */

import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { palette } from "@/components/workspace-ui";

// ── 8-bit warning triangle pixel map ─────────────────────────────────────────
// Each row is a list of [col, row] pairs that should be filled.
// The triangle fits in a 9×8 grid (col 0-8, row 0-7).
const PIXELS: [number, number][] = [
  // Row 0 — tip
  [4, 0],
  // Row 1
  [3, 1], [4, 1], [5, 1],
  // Row 2
  [3, 2], [5, 2],
  // Row 3
  [2, 3], [4, 3], [6, 3],
  // Row 4
  [2, 4], [6, 4],
  // Row 5 — exclamation body
  [1, 5], [4, 5], [7, 5],
  // Row 6 — exclamation dot gap
  [1, 6], [7, 6],
  // Row 7 — base
  [0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7],
];

interface PixelWarningProps {
  size?: number;
  color?: string;
  animate?: boolean;
}

export function PixelWarning({ size = 24, color = palette.amber, animate = true }: PixelWarningProps) {
  const pixelSize = Math.max(1, Math.round(size / 9));
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animate) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 380, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,    duration: 380, useNativeDriver: true }),
        Animated.delay(600),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [animate, opacity]);

  const gridWidth  = 9 * pixelSize;
  const gridHeight = 8 * pixelSize;

  return (
    <Animated.View style={{ width: gridWidth, height: gridHeight, opacity }}>
      {PIXELS.map(([col, row]) => (
        <View
          key={`${col}-${row}`}
          style={{
            position: "absolute",
            left: col * pixelSize,
            top:  row * pixelSize,
            width: pixelSize,
            height: pixelSize,
            backgroundColor: color,
          }}
        />
      ))}
    </Animated.View>
  );
}

// ── ValidationError banner ────────────────────────────────────────────────────
interface ValidationErrorProps {
  message: string | null;
  /** Field label to highlight in red (optional) */
  field?: string;
}

export function ValidationError({ message, field }: ValidationErrorProps) {
  if (!message) return null;
  return (
    <View style={ve.container}>
      <PixelWarning size={22} color={palette.rose} animate />
      <View style={ve.body}>
        {field ? <Text style={ve.field}>{field}</Text> : null}
        <Text style={ve.message}>{message}</Text>
      </View>
    </View>
  );
}

const ve = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#5C1E27",
    backgroundColor: "#2A0F14",
  },
  body: { flex: 1 },
  field: {
    color: palette.rose,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  message: {
    color: "#F4B8BE",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
});
