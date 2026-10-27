/**
 * Design tokens: the only place colours, spacing, radii, elevation and type are defined.
 *
 * Direction: a calm, premium fintech look. Neutral surfaces (soft off-white in light,
 * near-black slate in dark) with ONE confident accent: Meow teal. Teal was chosen over
 * indigo because it is already the brand colour of the app icon and splash, it reads as
 * "money / calm" rather than "alert", and it keeps AA contrast in both themes.
 */
import { Platform, TextStyle, ViewStyle } from "react-native";

export interface ColorTokens {
  background: string;
  surface: string;
  surfaceAlt: string;
  /** Cards that sit on top of other cards (dark mode layering). */
  surfaceRaised: string;
  border: string;
  /** Hairline dividers inside cards. */
  divider: string;
  text: string;
  textMuted: string;
  /** Even quieter text (placeholders, axis labels). Still AA on surface for large text only. */
  textFaint: string;
  primary: string;
  onPrimary: string;
  /** Tinted background for selected chips / segmented controls. */
  primarySoft: string;
  /** Text/icon colour on primarySoft. */
  onPrimarySoft: string;
  danger: string;
  onDanger: string;
  dangerSurface: string;
  warning: string;
  warningSurface: string;
  success: string;
  successSurface: string;
  /** Hero card gradient (Home / Reports totals). */
  heroStart: string;
  heroEnd: string;
  onHero: string;
  onHeroMuted: string;
  heroChip: string;
  tabBar: string;
  shadow: string;
  overlay: string;
  snackbar: string;
  onSnackbar: string;
  snackbarAction: string;
}

export const lightColors: ColorTokens = {
  background: "#F4F5F3",
  surface: "#FFFFFF",
  surfaceAlt: "#EDF0EE",
  surfaceRaised: "#FFFFFF",
  border: "#E1E5E2",
  divider: "#ECEFED",
  text: "#101716",
  textMuted: "#59645F",
  textFaint: "#6E7975",
  primary: "#0D7563",
  onPrimary: "#FFFFFF",
  primarySoft: "#E1F2EE",
  onPrimarySoft: "#08594B",
  danger: "#C0362C",
  onDanger: "#FFFFFF",
  dangerSurface: "#FCE9E7",
  warning: "#94580A",
  warningSurface: "#FDF1DC",
  success: "#1D7A45",
  successSurface: "#E3F4EA",
  heroStart: "#0A5246",
  heroEnd: "#0E6E5D",
  onHero: "#FFFFFF",
  onHeroMuted: "#D3ECE6",
  heroChip: "rgba(255,255,255,0.16)",
  tabBar: "#FFFFFF",
  shadow: "#0B1A16",
  overlay: "rgba(8,14,12,0.42)",
  snackbar: "#18211F",
  onSnackbar: "#F2F5F4",
  snackbarAction: "#7FDCC6",
};

export const darkColors: ColorTokens = {
  background: "#0A0E0D",
  surface: "#131918",
  surfaceAlt: "#1B2321",
  surfaceRaised: "#1F2826",
  border: "#252F2C",
  divider: "#202926",
  text: "#EDF2F0",
  textMuted: "#9AA6A2",
  textFaint: "#76827E",
  primary: "#5FD0B7",
  onPrimary: "#04251E",
  primarySoft: "#163631",
  onPrimarySoft: "#8EE3CF",
  danger: "#F2948B",
  onDanger: "#3D0A06",
  dangerSurface: "#3A1714",
  warning: "#F0BC66",
  warningSurface: "#33260F",
  success: "#6FD49A",
  successSurface: "#132E20",
  heroStart: "#0E3B34",
  heroEnd: "#145247",
  onHero: "#F2FBF8",
  onHeroMuted: "#A9CFC6",
  heroChip: "rgba(255,255,255,0.10)",
  tabBar: "#131918",
  shadow: "#000000",
  overlay: "rgba(0,0,0,0.62)",
  snackbar: "#E6ECEA",
  onSnackbar: "#101716",
  snackbarAction: "#0D7563",
};

/** 4/8-point spacing scale. */
export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radii = { sm: 8, md: 12, lg: 20, xl: 24, pill: 999 } as const;

export const typeScale = {
  caption: 12,
  small: 13,
  body: 15,
  bodyLarge: 17,
  title: 20,
  headline: 28,
  display: 34,
  hero: 40,
} as const;

/**
 * Inter is embedded natively (expo-font config plugin, one family with 400–800 weights),
 * so `fontFamily: FONT_FAMILY` plus a normal `fontWeight` picks the right file on Android.
 */
export const FONT_FAMILY = "Inter";

/** Tabular figures for every money amount, so columns of numbers line up. */
export const MONEY: TextStyle = { fontFamily: FONT_FAMILY, fontVariant: ["tabular-nums"] };

export const touchTarget = 48;

/** Soft card shadow in light mode; dark mode relies on layered surfaces instead. */
export function cardElevation(dark: boolean): ViewStyle {
  if (dark) return {};
  return Platform.select<ViewStyle>({
    android: { elevation: 1.5, shadowColor: lightColors.shadow },
    default: { shadowColor: lightColors.shadow, shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  });
}

/** Curated category palette: mid-tone hues that harmonise with the teal accent and read on both themes. */
export const categoryPalette = [
  "#D6457A", "#2E9A5C", "#E07A2F", "#3B7DD8", "#7B5CD6", "#1F98A6", "#BE4C9C",
  "#D5524C", "#B07A3F", "#8D6E63", "#E0619C", "#2F9AD4", "#4C5BD4", "#6B7C86",
  "#2A9D8F", "#A8840F", "#6A5ACD", "#6E9431",
] as const;

/** The pre-redesign palette, in the same order, so stored colours map 1:1 onto the new one at display time. */
const LEGACY_PALETTE = [
  "#C2185B", "#2E7D32", "#E65100", "#1565C0", "#6A1B9A", "#00838F", "#AD1457",
  "#C62828", "#795548", "#5D4037", "#D81B60", "#0277BD", "#283593", "#546E7A",
  "#00695C", "#9E7700", "#4527A0", "#558B2F",
] as const;
const LEGACY_TO_NEW = new Map<string, string>(LEGACY_PALETTE.map((c, i) => [c, categoryPalette[i]]));

/**
 * Display colour for a stored category colour. Stored data is never changed:
 * colours from the old palette are shown as their curated equivalent, anything else as-is.
 */
export function categoryColor(stored: string | null | undefined): string {
  if (!stored) return categoryPalette[13];
  return LEGACY_TO_NEW.get(stored.toUpperCase()) ?? stored;
}

/** Icons offered when creating or editing a category (Ionicons names). */
export const categoryIcons = [
  "bag-handle-outline", "cart-outline", "restaurant-outline", "cafe-outline", "car-outline", "bus-outline",
  "flash-outline", "phone-portrait-outline", "shirt-outline", "fitness-outline", "medkit-outline", "paw-outline",
  "home-outline", "gift-outline", "airplane-outline", "school-outline", "book-outline", "game-controller-outline",
  "film-outline", "musical-notes-outline", "construct-outline", "wifi-outline", "card-outline", "heart-outline",
  "people-outline", "happy-outline", "leaf-outline", "beer-outline", "pizza-outline", "ellipsis-horizontal-circle-outline",
] as const;
