import { Ionicons } from "@expo/vector-icons";
import { Children, Fragment, ReactNode } from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { useTheme } from "../theme/useTheme";
import { Card } from "./Card";
import { IconTile } from "./IconTile";
import { FONT_FAMILY } from "../theme/tokens";

/** Tappable settings-style row: optional icon tile, title, subtitle, chevron. */
export function ListRow({
  title,
  subtitle,
  left,
  icon,
  iconColor,
  destructive,
  value,
  onPress,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  icon?: string;
  iconColor?: string;
  destructive?: boolean;
  value?: string;
  onPress: () => void;
}) {
  const { colors, spacing, type } = useTheme();
  const tint = destructive ? colors.danger : (iconColor ?? colors.primary);
  const leading = left ?? (icon ? <IconTile icon={icon} color={tint} size={36} /> : null);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        minHeight: 60,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: pressed ? colors.surfaceAlt : "transparent",
      })}
    >
      {leading ? <View style={{ marginRight: spacing.md }}>{leading}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONT_FAMILY, color: destructive ? colors.danger : colors.text, fontSize: type.body, fontWeight: "600" }}>{title}</Text>
        {subtitle ? <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.small, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.small, marginRight: spacing.xs }}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

/** A card holding rows, with inset hairline dividers between them. */
export function ListGroup({ children, style, inset = 64 }: { children: ReactNode; style?: StyleProp<ViewStyle>; inset?: number }) {
  const { colors } = useTheme();
  const items = Children.toArray(children).filter(Boolean);
  return (
    <Card padded={false} style={[{ overflow: "hidden" }, style]}>
      {items.map((child, i) => (
        <Fragment key={i}>
          {i > 0 ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: inset }} /> : null}
          {child}
        </Fragment>
      ))}
    </Card>
  );
}
