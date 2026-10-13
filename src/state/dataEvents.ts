import { useEffect, useState } from "react";

/** Tiny change notifier so lists refresh after any expense is added, edited, deleted or restored. */
type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;

export function notifyDataChanged(): void {
  version += 1;
  listeners.forEach((l) => l());
}

export function subscribeDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Returns a number that increases whenever data changes. */
export function useDataVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => subscribeDataChanged(() => setV(version)), []);
  return v;
}
