/* Global test mocks for native modules that don't exist in Node. */
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

jest.mock("@react-native-community/datetimepicker", () => {
  const open = jest.fn();
  const Picker = () => null;
  return { __esModule: true, default: Picker, DateTimePickerAndroid: { open, dismiss: jest.fn() } };
});

// Icon fonts aren't loadable in Node; render icons as nothing.
jest.mock("@expo/vector-icons", () => {
  const Icon = () => null;
  Icon.glyphMap = new Proxy({}, { has: () => true });
  return { __esModule: true, Ionicons: Icon };
});

// Router hooks used by shared components (screens themselves aren't rendered in unit tests).
jest.mock("expo-router", () => ({
  useSegments: () => ["(tabs)"],
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), navigate: jest.fn() }),
}));

// Charts draw with native SVG; the text list next to the chart is what tests check.
jest.mock("react-native-gifted-charts", () => ({ PieChart: () => null, BarChart: () => null }));

// Native SQLite is never opened in unit tests (they use better-sqlite3); stub it so screens can be imported.
jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));

// Haptics are fire-and-forget feedback; record calls so tests can check they happen on save/delete/record.
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

// Decorative SVG (progress ring) and gradients render as plain views in Node.
jest.mock("react-native-svg", () => {
  const { View } = require("react-native");
  const Stub = (props: { children?: unknown }) => require("react").createElement(View, null, props.children);
  return { __esModule: true, default: Stub, Svg: Stub, Circle: Stub, Defs: Stub, LinearGradient: Stub, Stop: Stub, Rect: Stub, Path: Stub };
});
jest.mock("expo-linear-gradient", () => {
  const { View } = require("react-native");
  return { LinearGradient: View };
});
