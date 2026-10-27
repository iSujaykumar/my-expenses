import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { createRepositories, Repositories } from "../repo";
import { openAppDatabase } from "./expoAdapter";
import { DatabaseError } from "./types";
import { FONT_FAMILY } from "../theme/tokens";

const RepositoriesContext = createContext<Repositories | null>(null);

/** Opens + migrates the database once, showing a loading or error screen meanwhile. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [repos, setRepos] = useState<Repositories | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    openAppDatabase()
      .then((db) => {
        if (!cancelled) setRepos(createRepositories(db));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof DatabaseError ? e.message : "Could not open the expense database.");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setError(null);
    setAttempt((n) => n + 1);
  };

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={retry} style={styles.button}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  if (!repos) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return <RepositoriesContext.Provider value={repos}>{children}</RepositoriesContext.Provider>;
}

export function useRepositories(): Repositories {
  const repos = useContext(RepositoriesContext);
  if (!repos) throw new Error("useRepositories must be used inside DatabaseProvider");
  return repos;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontFamily: FONT_FAMILY, fontSize: 20, fontWeight: "700", marginBottom: 8 },
  body: { fontFamily: FONT_FAMILY, fontSize: 15, textAlign: "center", marginBottom: 16 },
  button: { backgroundColor: "#1F6F5C", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  buttonText: { fontFamily: FONT_FAMILY, color: "#FFFFFF", fontWeight: "600", fontSize: 16 },
});
