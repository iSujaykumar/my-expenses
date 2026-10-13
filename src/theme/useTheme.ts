import { useColorScheme } from "react-native";

import { ColorTokens, darkColors, lightColors, radii, spacing, typeScale } from "./tokens";

export interface Theme {
  dark: boolean;
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  type: typeof typeScale;
}

/** Follows the system light/dark setting (a saved preference arrives in a later phase). */
export function useTheme(): Theme {
  const dark = useColorScheme() === "dark";
  return { dark, colors: dark ? darkColors : lightColors, spacing, radii, type: typeScale };
}
