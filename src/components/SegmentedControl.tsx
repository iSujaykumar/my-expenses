import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";

import { useTheme } from "../theme/useTheme";
import { FONT_FAMILY } from "../theme/tokens";

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  testID?: string;
}

/** iOS/Android-style segmented control. Each segment is a radio button for screen readers. */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  accessibilityLabel,
  wrap = false,
}: {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  /** Allow segments to wrap onto a second row (for long option lists). */
  wrap?: boolean;
}) {
  const { colors, spacing, type, dark, elevation } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: "row", flexWrap: wrap ? "wrap" : "nowrap", backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 3 }}
    >
      {segments.map((s) => {
        const selected = s.value === value;
        return (
          <Pressable
            key={s.value}
            testID={s.testID}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={s.label}
            onPress={() => onChange(s.value)}
            style={[
              {
                flexGrow: 1,
                flexBasis: wrap ? "30%" : 0,
                minHeight: 42,
                borderRadius: 11,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                paddingHorizontal: spacing.sm,
                backgroundColor: selected ? (dark ? colors.surfaceRaised : colors.surface) : "transparent",
              },
              selected ? elevation : null,
            ]}
          >
            {s.icon ? <Ionicons name={s.icon} size={15} color={selected ? colors.primary : colors.textMuted} style={{ marginRight: spacing.xs + 1 }} /> : null}
            <Text numberOfLines={1} style={{ fontFamily: FONT_FAMILY, color: selected ? colors.text : colors.textMuted, fontSize: type.small, fontWeight: selected ? "600" : "500" }}>
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
