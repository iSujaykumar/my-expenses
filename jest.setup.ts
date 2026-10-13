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
