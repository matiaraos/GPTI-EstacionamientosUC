import type { TextStyle } from "react-native";
import { colors } from "./colors";

export { colors };

/** Escala de 4 puntos. El margen lateral de pantalla es `md`. */
export const spacing = {
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
  full: 9999,
} as const;

/** Estilos de texto con la rampa de la plataforma. La fuente es la del sistema. */
export const type = {
  largeTitle: { fontSize: 34, fontWeight: "700", color: colors.label },
  title: { fontSize: 22, fontWeight: "600", color: colors.label },
  headline: { fontSize: 17, fontWeight: "600", color: colors.label },
  body: { fontSize: 17, fontWeight: "400", color: colors.label },
  callout: { fontSize: 16, fontWeight: "400", color: colors.label },
  subhead: { fontSize: 15, fontWeight: "400", color: colors.secondaryLabel },
  footnote: { fontSize: 13, fontWeight: "400", color: colors.secondaryLabel },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof type;

/** Altura mínima de controles táctiles (44 pt en iOS, 48 dp en Android). */
export const minTouch = process.env.EXPO_OS === "android" ? 48 : 44;
