import { useLocalSearchParams } from "expo-router";
import { useHorario } from "@/horario/horario-provider";
import { BuscadorDestinos } from "./elegir-destino-screen";

/** Destino de un bloque del horario (en edición o importado). `q` precarga la ubicación del archivo. */
export default function HorarioDestinoScreen() {
  const { aplicarDestino } = useHorario();
  const { q } = useLocalSearchParams<{ q?: string }>();
  return <BuscadorDestinos onElegir={aplicarDestino} inicial={q ?? ""} />;
}
