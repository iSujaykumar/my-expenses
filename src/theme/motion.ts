import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** True when the phone's "Remove animations" / reduce-motion setting is on. Animations are switched off then. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => !cancelled && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** Content never gets wider than this on tablets / landscape, so lines stay readable. */
export const MAX_CONTENT_WIDTH = 720;
