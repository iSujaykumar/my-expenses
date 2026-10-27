import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { View } from "react-native";

import { useTheme } from "../theme/useTheme";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Adds an alpha channel to a #RRGGBB colour (falls back to the colour itself for other formats). */
export function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

/** Rounded-square tile with a tinted background and a coloured icon. Decorative: hidden from screen readers. */
export function IconTile({ icon, color, size = 40, solid = false }: { icon: string; color: string; size?: number; solid?: boolean }) {
  const { dark } = useTheme();
  const glyph = (icon in Ionicons.glyphMap ? icon : "pricetag-outline") as IconName;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        backgroundColor: solid ? color : withAlpha(color, dark ? 0.22 : 0.13),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={glyph} size={Math.round(size * 0.5)} color={solid ? "#FFFFFF" : color} />
    </View>
  );
}
