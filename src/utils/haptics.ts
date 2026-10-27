import * as Haptics from "expo-haptics";

/**
 * Light haptic feedback, used ONLY for save, delete and record.
 * Failures (no vibrator, web, tests) are ignored on purpose.
 */
export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function hapticWarning(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
