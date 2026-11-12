import { colors } from "@/theme";

// Las opciones del encabezado tipan los colores como `string`, pero aceptan colores de plataforma.
const color = (value: (typeof colors)[keyof typeof colors]) => value as string;

/** Opciones compartidas por todas las pilas de navegación. */
export const stackScreenOptions = {
  headerLargeTitleEnabled: true,
  headerShadowVisible: false,
  headerLargeTitleShadowVisible: false,
  headerStyle: { backgroundColor: color(colors.background) },
  headerTitleStyle: { color: color(colors.label) },
  headerTintColor: color(colors.accent),
  headerBackButtonDisplayMode: "minimal",
  contentStyle: { backgroundColor: colors.background },
} as const;
