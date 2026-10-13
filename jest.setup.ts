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
