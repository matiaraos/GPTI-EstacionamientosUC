import { useColorScheme, type TextStyle } from "react-native";
import { palettes, type Palette } from "./colors";

export type { Palette };

/** Escala de 4 puntos. Fila < grupo < sección: `sm` entre filas, `md` en márgenes, `xl` entre secciones. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 9999,
} as const;

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

/** Rampa tipográfica de la plataforma con la fuente del sistema (SF / Roboto). Los colores van aparte. */
export const type = {
  display: { fontSize: 44, lineHeight: 48, fontWeight: "800", letterSpacing: -0.5 },
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: "700", letterSpacing: -0.3 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 17, lineHeight: 22, fontWeight: "400" },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: "400" },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: "400" },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  /** Encabezado de sección: pequeño, en mayúsculas y espaciado. */
  overline: { fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof type;

/** Altura mínima de controles táctiles (44 pt en iOS, 48 dp en Android). */
export const minTouch = process.env.EXPO_OS === "android" ? 48 : 44;

export type Theme = { scheme: "light" | "dark"; colors: Palette };

/** Paleta del modo claro u oscuro según el sistema. Debe llamarse dentro de un componente. */
export function useTheme(): Theme {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return { scheme, colors: palettes[scheme] };
}
