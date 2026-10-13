/** Design tokens: the only place colours, spacing, radii and type sizes are defined. */

export interface ColorTokens {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  danger: string;
  onDanger: string;
  warning: string;
  warningSurface: string;
  success: string;
  overlay: string;
  snackbar: string;
  onSnackbar: string;
  snackbarAction: string;
}

export const lightColors: ColorTokens = {
  background: "#F6F7F5",
  surface: "#FFFFFF",
  surfaceAlt: "#EEF1EE",
  border: "#DDE2DE",
  text: "#18211D",
  textMuted: "#5D6A64",
  primary: "#1F6F5C",
  onPrimary: "#FFFFFF",
  danger: "#B3261E",
  onDanger: "#FFFFFF",
  warning: "#8A5A00",
  warningSurface: "#FFF1D6",
  success: "#2E7D32",
  overlay: "rgba(0,0,0,0.35)",
  snackbar: "#22302A",
  onSnackbar: "#F2F5F3",
  snackbarAction: "#8FD9C3",
};

export const darkColors: ColorTokens = {
  background: "#0F1412",
  surface: "#171E1B",
  surfaceAlt: "#212A26",
  border: "#2E3934",
  text: "#E8EEEA",
  textMuted: "#9DABA4",
  primary: "#6FCFB4",
  onPrimary: "#062A20",
  danger: "#F2B8B5",
  onDanger: "#601410",
  warning: "#F3C46B",
  warningSurface: "#3A2C0C",
  success: "#81C784",
  overlay: "rgba(0,0,0,0.6)",
  snackbar: "#E3EAE6",
  onSnackbar: "#18211D",
  snackbarAction: "#1F6F5C",
};

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radii = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const typeScale = {
  caption: 12,
  small: 13,
  body: 15,
  bodyLarge: 17,
  title: 20,
  headline: 24,
  display: 32,
} as const;

export const touchTarget = 48;

/** Category colour palette (readable on light and dark backgrounds). */
export const categoryPalette = [
  "#C2185B", "#2E7D32", "#E65100", "#1565C0", "#6A1B9A", "#00838F", "#AD1457",
  "#C62828", "#795548", "#5D4037", "#D81B60", "#0277BD", "#283593", "#546E7A",
  "#00695C", "#9E7700", "#4527A0", "#558B2F",
] as const;

/** Icons offered when creating or editing a category (Ionicons names). */
export const categoryIcons = [
  "bag-handle-outline", "cart-outline", "restaurant-outline", "cafe-outline", "car-outline", "bus-outline",
  "flash-outline", "phone-portrait-outline", "shirt-outline", "fitness-outline", "medkit-outline", "paw-outline",
  "home-outline", "gift-outline", "airplane-outline", "school-outline", "book-outline", "game-controller-outline",
  "film-outline", "musical-notes-outline", "construct-outline", "wifi-outline", "card-outline", "heart-outline",
  "people-outline", "happy-outline", "leaf-outline", "beer-outline", "pizza-outline", "ellipsis-horizontal-circle-outline",
] as const;
