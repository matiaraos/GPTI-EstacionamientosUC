import { NativeTabs } from "expo-router/unstable-native-tabs";
import { SolicitudProvider } from "@/reserva/solicitud-provider";

export default function AppLayout() {
  return (
    <SolicitudProvider>
      <NativeTabs>
        <NativeTabs.Trigger name="(reservar)">
          <NativeTabs.Trigger.Icon sf="parkingsign.circle" md="local_parking" />
          <NativeTabs.Trigger.Label>Reservar</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(cuenta)">
          <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
          <NativeTabs.Trigger.Label>Cuenta</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </SolicitudProvider>
  );
}
