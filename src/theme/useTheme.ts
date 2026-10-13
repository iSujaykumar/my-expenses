import { createContext, useContext } from "react";
import { useColorScheme } from "react-native";

import { ColorTokens, darkColors, lightColors, radii, spacing, typeScale } from "./tokens";

export type ThemePreference = "system" | "light" | "dark";

/** Saved theme choice, provided by AppSettings (defaults to following the system). */
export const ThemePreferenceContext = createContext<ThemePreference>("system");

export interface Theme {
  dark: boolean;
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  type: typeof typeScale;
}

export function resolveDark(preference: ThemePreference, system: string | null | undefined): boolean {
  return preference === "system" ? system === "dark" : preference === "dark";
}

/** Theme for the saved preference: light, dark, or follow the phone. */
export function useTheme(): Theme {
  const preference = useContext(ThemePreferenceContext);
  const dark = resolveDark(preference, useColorScheme());
  return { dark, colors: dark ? darkColors : lightColors, spacing, radii, type: typeScale };
}
