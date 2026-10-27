import { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

/** Circular progress (0..1, clamped) with optional centre content. Purely visual: give the parent an accessibility label. */
export function ProgressRing({
  size,
  stroke,
  progress,
  color,
  track,
  children,
}: {
  size: number;
  stroke: number;
  progress: number;
  color: string;
  track: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {p > 0 ? (
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - p)} />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}
