import { TextStyle } from "react-native";

import { FONT_FAMILY } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";

/** Shared look for text inputs and input-like buttons: filled, borderless until focused or invalid. */
export function useInputStyle(options: { invalid?: boolean; focused?: boolean } = {}): TextStyle {
  const { colors, spacing, type } = useTheme();
  return {
    minHeight: 52,
    paddingHorizontal: spacing.lg - 2,
    paddingVertical: spacing.md,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: options.invalid ? colors.danger : options.focused ? colors.primary : "transparent",
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    fontSize: type.body,
    fontFamily: FONT_FAMILY,
  };
}
