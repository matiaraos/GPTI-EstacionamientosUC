import type { Destino } from "./catalogo";
import { apiRequest } from "./client";

export type BloqueClase = {
  id: number;
  /** 1 = lunes … 7 = domingo. */
  diaSemana: number;
  inicio: string;
  fin: string;
  titulo: string | null;
  origen: "manual" | "ics" | "uc";
  destino: Destino;
  /** Curso UC del que proviene el bloque, si se sincronizó desde el horario UC. */
  curso: { sigla: string; seccion: number; nombre: string; nrc: string; tipo: string; modulos: string; sala: string | null } | null;
};

export type DatosBloque = { diaSemana: number; inicio: string; fin: string; destinoId: number | null; titulo?: string | null; origen?: "manual" | "ics" };

export type BloqueImportado = {
  diaSemana: number;
  inicio: string;
  fin: string;
  titulo: string | null;
  ubicacion: string | null;
  destino: Destino | null;
  coincidencias: Destino[];
  problemas: string[];
};

export const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"];

export function obtenerHorario(token: string) {
  return apiRequest<{ bloques: BloqueClase[] }>("/horario", { token });
}

export function crearBloque(token: string, datos: DatosBloque) {
  return apiRequest<{ bloque: BloqueClase }>("/horario/bloques", { method: "POST", body: datos, token });
}

export function editarBloque(token: string, id: number, datos: DatosBloque) {
  return apiRequest<{ bloque: BloqueClase }>(`/horario/bloques/${id}`, { method: "PATCH", body: datos, token });
}

export function eliminarBloque(token: string, id: number) {
  return apiRequest<void>(`/horario/bloques/${id}`, { method: "DELETE", token });
}

/** Reemplaza el horario completo. Si algún bloque es inválido, la API no cambia nada. */
export function reemplazarHorario(token: string, bloques: DatosBloque[]) {
  return apiRequest<{ bloques: BloqueClase[] }>("/horario", { method: "PUT", body: { bloques }, token });
}

/** Vista previa del archivo; no guarda nada. */
export function previsualizarIcs(token: string, contenido: string) {
  return apiRequest<{ bloques: BloqueImportado[]; omitidos: string[] }>("/horario/importar", {
    method: "POST",
    body: { contenido },
    token,
    timeoutMs: 20_000,
  });
}

// Horario UC (conexión simulada con estudiantes de prueba y secciones reales de Buscacursos)

export type ModuloUC = { modulo: number; inicio: string; fin: string };

export type ActividadUC = {
  id: number;
  tipo: string;
  tipoNombre: string;
  /** Formato de Buscacursos, por ejemplo `L-W-V:4`. */
  modulos: string;
  horas: string;
  sala: string | null;
  destino: Destino | null;
};

export type SeccionUC = { nrc: string; sigla: string; seccion: number; nombre: string; creditos: number; semestre: string; actividades: ActividadUC[] };

export type ConexionUC = {
  perfil: { codigo: string; nombre: string; carrera: string };
  semestre: string | null;
  conectadaEn: string;
  sincronizadaEn: string | null;
  inscripcion: SeccionUC[];
  creditos: number;
};

export type PerfilUC = { codigo: string; nombre: string; carrera: string; cursos: number };

export type BloqueUCPropuesto = {
  clave: string;
  actividadUCId: number;
  sigla: string;
  seccion: number;
  curso: string;
  tipo: string;
  tipoNombre: string;
  modulosTexto: string;
  modulos: number[];
  diaSemana: number;
  inicio: string;
  fin: string;
  titulo: string;
  sala: string | null;
  destino: Destino | null;
  coincidencias: Destino[];
  problemas: string[];
  incluir: boolean;
  cambio: "nuevo" | "sin_cambios" | "modificado";
};

export type VistaPreviaUC = {
  bloques: BloqueUCPropuesto[];
  eliminados: { id: number; titulo: string | null; diaSemana: number; inicio: string; fin: string; destino: Destino }[];
};

export function estadoHorarioUC(token: string) {
  return apiRequest<{ conexion: ConexionUC | null; perfiles: PerfilUC[]; modulos: ModuloUC[] }>("/horario/uc", { token });
}

export function conectarHorarioUC(token: string, perfil: string) {
  return apiRequest<{ conexion: ConexionUC }>("/horario/uc/conectar", { method: "POST", body: { perfil }, token });
}

export type CambioInscripcion = { accion: "agregar" | "quitar"; nrc: string } | { accion: "cambiar"; nrc: string; por: string };

export function modificarInscripcion(token: string, cambio: CambioInscripcion) {
  return apiRequest<{ conexion: ConexionUC }>("/horario/uc/inscripcion", { method: "PATCH", body: cambio, token });
}

export function vistaPreviaUC(token: string) {
  return apiRequest<VistaPreviaUC>("/horario/uc/vista-previa", { method: "POST", token });
}

export function sincronizarHorarioUC(token: string, bloques: { actividadUCId: number; diaSemana: number; inicio: string; fin: string; destinoId: number | null }[]) {
  return apiRequest<{ conexion: ConexionUC }>("/horario/uc", { method: "PUT", body: { bloques }, token });
}

export function desconectarHorarioUC(token: string, bloques: "quitar" | "conservar") {
  return apiRequest<void>(`/horario/uc?bloques=${bloques}`, { method: "DELETE", token });
}

export function buscarSeccionesUC(token: string, q: string) {
  return apiRequest<{ secciones: SeccionUC[]; modulos: ModuloUC[] }>(`/cursos-uc?q=${encodeURIComponent(q)}`, { token });
}

/** Módulos UC (Buscacursos). Se usan para mostrar «M4» o «M5–6» junto a la hora. */
export const MODULOS_UC: ModuloUC[] = [
  { modulo: 1, inicio: "08:20", fin: "09:30" },
  { modulo: 2, inicio: "09:40", fin: "10:50" },
  { modulo: 3, inicio: "11:00", fin: "12:10" },
  { modulo: 4, inicio: "12:20", fin: "13:30" },
  { modulo: 5, inicio: "14:50", fin: "16:00" },
  { modulo: 6, inicio: "16:10", fin: "17:20" },
  { modulo: 7, inicio: "17:30", fin: "18:40" },
  { modulo: 8, inicio: "18:50", fin: "20:00" },
  { modulo: 9, inicio: "20:10", fin: "21:20" },
];

/** «M4» si el bloque coincide con módulos UC, «M5–6» si abarca varios; si no, nada. */
export function etiquetaModulos(inicio: string, fin: string): string | null {
  const desde = MODULOS_UC.find((m) => m.inicio === inicio);
  const hasta = MODULOS_UC.find((m) => m.fin === fin);
  if (!desde || !hasta || hasta.modulo < desde.modulo) return null;
  return desde.modulo === hasta.modulo ? `M${desde.modulo}` : `M${desde.modulo}–${hasta.modulo}`;
}
