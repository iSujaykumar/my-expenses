import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

import { SnackbarProvider } from "../src/components/Snackbar";
import { DatabaseProvider } from "../src/db/DatabaseProvider";
import { useTheme } from "../src/theme/useTheme";

export default function RootLayout() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <DatabaseProvider>
        <SnackbarProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="expense/new" options={{ animation: "slide_from_bottom" }} />
            <Stack.Screen name="expense/[id]" />
          </Stack>
        </SnackbarProvider>
      </DatabaseProvider>
      <StatusBar style="auto" />
    </View>
  );
}
