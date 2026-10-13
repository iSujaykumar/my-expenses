import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { View } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Category icon in a tinted circle, using the category's own colour everywhere. */
export function CategoryIcon({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  const name: IconName = icon in Ionicons.glyphMap ? (icon as IconName) : "pricetag-outline";
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}22`, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={name} size={size * 0.5} color={color} />
    </View>
  );
}
