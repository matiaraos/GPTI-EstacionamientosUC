import { useTheme } from "@/theme";

/** Opciones compartidas por todas las pilas de navegación, según el modo claro u oscuro. */
export function useStackOptions() {
  const { colors } = useTheme();
  return {
    headerLargeTitleEnabled: true,
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerTitleStyle: { color: colors.label },
    headerLargeTitleStyle: { color: colors.label },
    headerTintColor: colors.accent,
    headerBackButtonDisplayMode: "minimal",
    contentStyle: { backgroundColor: colors.background },
  } as const;
}
