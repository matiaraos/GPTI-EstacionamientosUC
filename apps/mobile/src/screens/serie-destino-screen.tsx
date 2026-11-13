import { useSerie } from "@/reserva/serie-provider";
import { BuscadorDestinos } from "./elegir-destino-screen";

export default function SerieDestinoScreen() {
  const { actualizar } = useSerie();
  return <BuscadorDestinos onElegir={(destino) => actualizar({ destino })} />;
}
