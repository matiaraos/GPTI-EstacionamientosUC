/**
 * Paleta de MiEstacionamientoUC: azul institucional y neutros propios, iguales en Android e iOS.
 *
 * Es un tratamiento deliberado y neutral respecto de la plataforma: la marca no cambia con el fondo
 * de pantalla del teléfono (Material You) y las superficies mantienen el mismo contraste en ambos
 * sistemas. Cada color tiene su par claro/oscuro; se leen con `useTheme()`.
 */
export type Palette = {
  /** Fondo de pantalla, detrás de los grupos. */
  background: string;
  /** Superficie de grupos, tarjetas y filas. */
  surface: string;
  /** Superficie secundaria: campos de texto y fondos de iconos neutros. */
  surfaceMuted: string;
  label: string;
  secondaryLabel: string;
  tertiaryLabel: string;
  placeholder: string;
  separator: string;
  /** Marca: botones primarios, enlaces y selección. */
  accent: string;
  accentPressed: string;
  onAccent: string;
  /** Fondo suave de marca para insignias, iconos y avisos informativos. */
  accentSoft: string;
  /** Texto de marca sobre `accentSoft` o sobre superficies. */
  accentText: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
};

export const palettes: Record<"light" | "dark", Palette> = {
  light: {
    background: "#F2F4F8",
    surface: "#FFFFFF",
    surfaceMuted: "#EDF0F5",
    label: "#0E1726",
    secondaryLabel: "#556070",
    tertiaryLabel: "#7D8796",
    placeholder: "#8C95A3",
    separator: "#E1E6ED",
    accent: "#0B4F9C",
    accentPressed: "#083F7E",
    onAccent: "#FFFFFF",
    accentSoft: "#E3ECF8",
    accentText: "#0B4F9C",
    danger: "#C62828",
    dangerSoft: "#FCEBEB",
    success: "#1B7F3B",
    successSoft: "#E4F3E9",
    warning: "#A15C07",
    warningSoft: "#FCF1E1",
  },
  dark: {
    background: "#0A0E14",
    surface: "#151B23",
    surfaceMuted: "#1E2630",
    label: "#F1F4F8",
    secondaryLabel: "#A5AFBC",
    tertiaryLabel: "#7B8594",
    placeholder: "#6D7786",
    separator: "#262E39",
    accent: "#6FA8FF",
    accentPressed: "#5B93EA",
    onAccent: "#06213F",
    accentSoft: "#14284A",
    accentText: "#8DBBFF",
    danger: "#FF7B7B",
    dangerSoft: "#3A1719",
    success: "#5BD68A",
    successSoft: "#12301F",
    warning: "#F5B65B",
    warningSoft: "#36260F",
  },
};
