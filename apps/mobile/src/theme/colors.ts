import { Color } from "expo-router";
import { Platform } from "react-native";

/**
 * Paleta semántica: se resuelve en el dispositivo y se adapta a modo claro/oscuro y accesibilidad.
 * Los colores de estado (disponible, ocupado) se usarán desde la reserva (04A).
 */
export const colors = {
  label: Platform.select({ ios: Color.ios.label, android: Color.android.dynamic.onSurface, default: "#0f172a" })!,
  secondaryLabel: Platform.select({
    ios: Color.ios.secondaryLabel,
    android: Color.android.dynamic.onSurfaceVariant,
    default: "#475569",
  })!,
  placeholder: Platform.select({
    ios: Color.ios.placeholderText,
    android: Color.android.dynamic.outline,
    default: "#94a3b8",
  })!,
  separator: Platform.select({
    ios: Color.ios.separator,
    android: Color.android.dynamic.outlineVariant,
    default: "#cbd5e1",
  })!,
  background: Platform.select({
    ios: Color.ios.systemGroupedBackground,
    android: Color.android.dynamic.surface,
    default: "#f8fafc",
  })!,
  surface: Platform.select({
    ios: Color.ios.secondarySystemGroupedBackground,
    android: Color.android.dynamic.surfaceContainer,
    default: "#ffffff",
  })!,
  field: Platform.select({
    ios: Color.ios.tertiarySystemFill,
    android: Color.android.dynamic.surfaceContainerHighest,
    default: "#f1f5f9",
  })!,
  accent: Platform.select({ ios: Color.ios.systemBlue, android: Color.android.dynamic.primary, default: "#2563eb" })!,
  onAccent: Platform.select({ ios: "#ffffff", android: Color.android.dynamic.onPrimary, default: "#ffffff" })!,
  danger: Platform.select({ ios: Color.ios.systemRed, android: Color.android.dynamic.error, default: "#dc2626" })!,
  dangerSurface: Platform.select({
    ios: Color.ios.secondarySystemGroupedBackground,
    android: Color.android.dynamic.errorContainer,
    default: "#fef2f2",
  })!,
  success: Platform.select({ ios: Color.ios.systemGreen, android: "#1b7f3b", default: "#059669" })!,
};
