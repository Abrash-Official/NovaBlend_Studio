import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { Platform, StatusBar, View, type ViewProps } from "react-native";

type Insets = { top: number; right: number; bottom: number; left: number };

const SafeAreaContext = createContext<Insets>({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});

export function SafeAreaProvider({ children }: { children: ReactNode }) {
  const insets = useMemo<Insets>(
    () => ({
      top: Platform.OS === "android" ? StatusBar.currentHeight || 24 : 44,
      right: 0,
      bottom: Platform.OS === "android" ? 16 : 28,
      left: 0,
    }),
    [],
  );
  return (
    <SafeAreaContext.Provider value={insets}>{children}</SafeAreaContext.Provider>
  );
}

export function useSafeAreaInsets() {
  return useContext(SafeAreaContext);
}

export function SafeAreaView({
  style,
  children,
  ...rest
}: ViewProps & { children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          flex: 1,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
