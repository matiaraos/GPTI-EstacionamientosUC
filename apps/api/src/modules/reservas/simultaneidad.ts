type Pendiente = {
  puntaje: number;
  recibida: number;
  orden: number;
  tarea: () => Promise<unknown>;
  resolver: (valor: unknown) => void;
  rechazar: (error: unknown) => void;
};

/**
 * Agrupa las solicitudes que llegan dentro de una ventana de simultaneidad y las procesa por ranking
 * descendente y luego por antigüedad (hora de llegada de la solicitud). Con ventana 0 cada solicitud
 * se procesa de inmediato. Los lotes se agrupan por clave (la fecha de la visita).
 *
 * El orden se resuelve en el proceso de la API: el piloto usa una sola instancia. Con varias, haría
 * falta una cola compartida; la base sigue impidiendo solapes en cualquier caso.
 */
export class CoordinadorSimultaneidad {
  private readonly lotes = new Map<string, Pendiente[]>();
  private contador = 0;

  constructor(
    private readonly ventanaMs: number,
    private readonly ahora: () => number = Date.now,
  ) {}

  /**
   * `recibida` es la hora de llegada de la solicitud al servidor (antes de validarla), para que la
   * antigüedad no dependa de cuánto tardó cada solicitud en prepararse.
   */
  encolar<T>(clave: string, puntaje: number, tarea: () => Promise<T>, recibida = this.ahora()): Promise<T> {
    if (this.ventanaMs <= 0) {
      return tarea();
    }
    return new Promise<T>((resolver, rechazar) => {
      const pendiente: Pendiente = {
        puntaje,
        recibida,
        orden: this.contador++,
        tarea,
        resolver: resolver as (valor: unknown) => void,
        rechazar,
      };
      const lote = this.lotes.get(clave);
      if (lote) {
        lote.push(pendiente);
        return;
      }
      this.lotes.set(clave, [pendiente]);
      setTimeout(() => void this.procesar(clave), this.ventanaMs);
    });
  }

  private async procesar(clave: string) {
    const lote = this.lotes.get(clave) ?? [];
    this.lotes.delete(clave);
    lote.sort((a, b) => b.puntaje - a.puntaje || a.recibida - b.recibida || a.orden - b.orden);
    for (const pendiente of lote) {
      try {
        pendiente.resolver(await pendiente.tarea());
      } catch (error) {
        pendiente.rechazar(error);
      }
    }
  }
}
