import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { useTheme } from "../theme/useTheme";

/** Rounded surface used for every grouped block. Soft shadow in light mode, layered surface in dark. */
export function Card({
  children,
  style,
  padded = true,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  testID?: string;
}) {
  const { colors, radii, spacing, elevation } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: padded ? spacing.lg : 0,
        },
        elevation,
        style,
      ]}
    >
      {children}
    </View>
  );
}
