import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSegments } from "expo-router";

import { useTheme } from "../theme/useTheme";

export interface SnackbarOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** ms, default 6000 */
  duration?: number;
}

/** Approximate heights of what sits at the bottom of each kind of screen. */
const TAB_BAR_HEIGHT = 56;
const FAB_SPACE = 56 + 16;
const FOOTER_BAR_HEIGHT = 76;

/**
 * Bottom offset that keeps the snackbar above the system navigation bar (safe-area inset)
 * plus the tab bar and FAB on tab screens, or the Save/footer bar on full-screen pages.
 */
export function snackbarBottomOffset(insetBottom: number, onTabScreen: boolean, gap = 8): number {
  return insetBottom + gap + (onTabScreen ? TAB_BAR_HEIGHT + FAB_SPACE : FOOTER_BAR_HEIGHT);
}

const SnackbarContext = createContext<(options: SnackbarOptions) => void>(() => {});

export function useSnackbar() {
  return useContext(SnackbarContext);
}

/** Shows one message at a time above the tab bar, e.g. "Expense deleted - Undo". */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<SnackbarOptions | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const onTabScreen = segments[0] === "(tabs)";
  const { colors, spacing, radii, type } = useTheme();

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setCurrent(null);
  }, []);

  const show = useCallback(
    (options: SnackbarOptions) => {
      if (timer.current) clearTimeout(timer.current);
      setCurrent(options);
      timer.current = setTimeout(() => setCurrent(null), options.duration ?? 6000);
    },
    [],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <SnackbarContext.Provider value={show}>
      {children}
      {current ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.bar,
            { bottom: snackbarBottomOffset(insets.bottom, onTabScreen), backgroundColor: colors.snackbar, borderRadius: radii.md, padding: spacing.md, marginHorizontal: spacing.lg },
          ]}
        >
          <Text style={{ color: colors.onSnackbar, fontSize: type.body, flex: 1 }}>{current.message}</Text>
          {current.actionLabel && current.onAction ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => {
                const action = current.onAction;
                hide();
                action?.();
              }}
              style={{ paddingHorizontal: spacing.sm }}
            >
              <Text style={{ color: colors.snackbarAction, fontWeight: "700", fontSize: type.body }}>{current.actionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </SnackbarContext.Provider>
  );
}

const styles = StyleSheet.create({
  bar: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "center", elevation: 6 },
});
