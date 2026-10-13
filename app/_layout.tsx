import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ReactNode } from "react";
import { View } from "react-native";

import { SnackbarProvider } from "../src/components/Snackbar";
import { DatabaseProvider } from "../src/db/DatabaseProvider";
import { AppSettingsProvider, useAppSettings } from "../src/state/AppSettings";
import { ThemePreferenceContext, useTheme } from "../src/theme/useTheme";

function ThemedRoot({ children }: { children: ReactNode }) {
  const { settings } = useAppSettings();
  return <ThemePreferenceContext.Provider value={settings.theme}>{children}</ThemePreferenceContext.Provider>;
}

function AppShell() {
  const { colors, dark } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SnackbarProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="expense/new" options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="expense/[id]" />
        </Stack>
      </SnackbarProvider>
      <StatusBar style={dark ? "light" : "dark"} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <AppSettingsProvider>
        <ThemedRoot>
          <AppShell />
        </ThemedRoot>
      </AppSettingsProvider>
    </DatabaseProvider>
  );
}
