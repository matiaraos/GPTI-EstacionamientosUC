import { useQuery } from "@tanstack/react-query";
import { obtenerHorario, type BloqueClase } from "@/api/horario";
import { dateDesdeTexto } from "@/lib/tiempo";
import { useSession } from "@/session/session-provider";

/** Día de la semana de una fecha (1 = lunes … 7 = domingo). */
function diaSemana(fecha: string): number {
  const dia = dateDesdeTexto(fecha).getDay();
  return dia === 0 ? 7 : dia;
}

/**
 * Clases del horario que caen dentro de la visita. Si hay alguna, la API usa la primera como destino
 * y la última para desempatar; la app solo lo muestra.
 */
export function useClasesDeVisita(fecha: string, llegada: string, salida: string): BloqueClase[] {
  const { token } = useSession();
  const horario = useQuery({ queryKey: ["horario"], queryFn: () => obtenerHorario(token!), enabled: Boolean(token) });
  const dia = diaSemana(fecha);
  return (horario.data?.bloques ?? []).filter((b) => b.diaSemana === dia && b.inicio < salida && llegada < b.fin);
}
