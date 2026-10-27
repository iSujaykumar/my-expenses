import { createContext, useContext } from "react";
import { useColorScheme, ViewStyle } from "react-native";

import { cardElevation, ColorTokens, darkColors, lightColors, radii, spacing, typeScale } from "./tokens";

export type ThemePreference = "system" | "light" | "dark";

/** Saved theme choice, provided by AppSettings (defaults to following the system). */
export const ThemePreferenceContext = createContext<ThemePreference>("system");

export interface Theme {
  dark: boolean;
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  type: typeof typeScale;
  /** Card shadow (light) or nothing (dark uses layered surfaces). */
  elevation: ViewStyle;
}

export function resolveDark(preference: ThemePreference, system: string | null | undefined): boolean {
  return preference === "system" ? system === "dark" : preference === "dark";
}

const LIGHT_ELEVATION = cardElevation(false);
const DARK_ELEVATION = cardElevation(true);

/** Theme for the saved preference: light, dark, or follow the phone. */
export function useTheme(): Theme {
  const preference = useContext(ThemePreferenceContext);
  const dark = resolveDark(preference, useColorScheme());
  return { dark, colors: dark ? darkColors : lightColors, spacing, radii, type: typeScale, elevation: dark ? DARK_ELEVATION : LIGHT_ELEVATION };
}
