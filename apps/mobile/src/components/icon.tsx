import { SymbolView } from "expo-symbols";
import type { ColorValue } from "react-native";
import { iconSize } from "@/theme";

/**
 * Iconos de la app: SF Symbols en iOS y Material Symbols en Android, una sola familia por
 * plataforma. Los nombres son semánticos para que las pantallas no dependan de cada catálogo.
 */
const ICONOS = {
  parking: { ios: "parkingsign", android: "local_parking" },
  car: { ios: "car.fill", android: "directions_car" },
  walk: { ios: "figure.walk", android: "directions_walk" },
  clock: { ios: "clock", android: "schedule" },
  calendar: { ios: "calendar", android: "calendar_today" },
  arrival: { ios: "arrow.down.to.line", android: "login" },
  departure: { ios: "arrow.up.to.line", android: "logout" },
  pin: { ios: "mappin.and.ellipse", android: "location_on" },
  room: { ios: "door.left.hand.open", android: "meeting_room" },
  building: { ios: "building.2", android: "apartment" },
  qr: { ios: "qrcode.viewfinder", android: "qr_code_scanner" },
  mail: { ios: "envelope", android: "mail" },
  plate: { ios: "rectangle.and.text.magnifyingglass", android: "badge" },
  person: { ios: "person.crop.circle", android: "account_circle" },
  logout: { ios: "rectangle.portrait.and.arrow.right", android: "logout" },
  chevron: { ios: "chevron.right", android: "chevron_right" },
  search: { ios: "magnifyingglass", android: "search" },
  error: { ios: "exclamationmark.circle.fill", android: "error" },
  success: { ios: "checkmark.circle.fill", android: "check_circle" },
  info: { ios: "info.circle.fill", android: "info" },
  wifi: { ios: "antenna.radiowaves.left.and.right", android: "wifi" },
  eye: { ios: "eye", android: "visibility" },
  eyeOff: { ios: "eye.slash", android: "visibility_off" },
  empty: { ios: "calendar.badge.exclamationmark", android: "event_busy" },
  cancel: { ios: "xmark.circle", android: "cancel" },
  key: { ios: "key", android: "key" },
  link: { ios: "link", android: "link" },
  import: { ios: "square.and.arrow.down", android: "file_open" },
} as const;

export type IconName = keyof typeof ICONOS;

type Props = {
  name: IconName;
  size?: number;
  color: ColorValue;
  /** Descripción para lectores de pantalla; sin ella el icono es decorativo. */
  label?: string;
};

export function Icon({ name, size = iconSize.md, color, label }: Props) {
  return (
    <SymbolView
      name={ICONOS[name]}
      size={size}
      tintColor={color}
      resizeMode="scaleAspectFit"
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? "yes" : "no-hide-descendants"}
      accessibilityLabel={label}
      style={{ width: size, height: size }}
    />
  );
}
