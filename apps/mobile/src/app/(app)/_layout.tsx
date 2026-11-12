import { NativeTabs } from "expo-router/unstable-native-tabs";
import { HorarioProvider } from "@/horario/horario-provider";
import { SolicitudProvider } from "@/reserva/solicitud-provider";
import { useTheme } from "@/theme";

export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <SolicitudProvider>
      <HorarioProvider>
      <NativeTabs
        tintColor={colors.accent}
        iconColor={{ default: colors.tertiaryLabel, selected: colors.accent }}
        indicatorColor={colors.accentSoft}
        backgroundColor={colors.surface}
        labelStyle={{ default: { color: colors.secondaryLabel }, selected: { color: colors.accentText } }}
      >
        <NativeTabs.Trigger name="(reservar)">
          <NativeTabs.Trigger.Icon sf="parkingsign.circle" md="local_parking" />
          <NativeTabs.Trigger.Label>Reservar</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(mi-reserva)">
          <NativeTabs.Trigger.Icon sf="car.fill" md="directions_car" />
          <NativeTabs.Trigger.Label>Mi reserva</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(cuenta)">
          <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
          <NativeTabs.Trigger.Label>Cuenta</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
      </HorarioProvider>
    </SolicitudProvider>
  );
}
