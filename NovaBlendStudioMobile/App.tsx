import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "./src/components/SafeArea";
import { HomeScreen } from "./src/components/HomeScreen";
import { EditorScreen } from "./src/components/EditorScreen";
import { useEditorStore } from "./src/store/editorStore";
import { hydrateProjects } from "./src/lib/projects";
import { checkForAppUpdate } from "./src/lib/updateCheck";
import { colors } from "./src/theme";
import Constants from "expo-constants";

export default function App() {
  const view = useEditorStore((s) => s.view);

  useEffect(() => {
    void hydrateProjects();
    const version = Constants.expoConfig?.version || "1.0.0";
    void checkForAppUpdate(version);
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        {view === "home" ? <HomeScreen /> : <EditorScreen />}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
