/** Punto GeoJSON: [longitud, latitud]. */
export type Coordenada = [number, number];

export type Poligono = { type: "Polygon"; coordinates: Coordenada[][] };

const RADIO_TIERRA_M = 6_371_000;

/** Proyección equirectangular local en metros; suficiente para distancias dentro de un campus. */
function aMetros([lon, lat]: Coordenada, latReferencia: number): [number, number] {
  const rad = Math.PI / 180;
  return [lon * rad * RADIO_TIERRA_M * Math.cos(latReferencia * rad), lat * rad * RADIO_TIERRA_M];
}

function dentroDelAnillo(punto: Coordenada, anillo: Coordenada[]): boolean {
  const [x, y] = punto;
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      dentro = !dentro;
    }
  }
  return dentro;
}

/** Distancia en metros del punto al borde más cercano del anillo. */
function distanciaAlBorde(punto: Coordenada, anillo: Coordenada[]): number {
  const lat = punto[1];
  const [px, py] = aMetros(punto, lat);
  let minima = Infinity;
  for (let i = 0; i < anillo.length - 1; i++) {
    const [ax, ay] = aMetros(anillo[i], lat);
    const [bx, by] = aMetros(anillo[i + 1], lat);
    const dx = bx - ax;
    const dy = by - ay;
    const largo = dx * dx + dy * dy;
    const t = largo === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / largo));
    minima = Math.min(minima, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return minima;
}

/**
 * Indica si el punto está dentro del polígono o a menos de `margenMetros` de su borde. El margen
 * absorbe el error típico del GPS del teléfono.
 */
export function dentroDelPerimetro(punto: Coordenada, poligono: Poligono, margenMetros: number): boolean {
  const [exterior, ...huecos] = poligono.coordinates;
  if (!exterior || exterior.length < 4) {
    return false;
  }
  const enExterior = dentroDelAnillo(punto, exterior) && !huecos.some((hueco) => dentroDelAnillo(punto, hueco));
  return enExterior || distanciaAlBorde(punto, exterior) <= margenMetros;
}

export function esPoligono(valor: unknown): valor is Poligono {
  const geometria = valor as Poligono | null;
  return (
    geometria?.type === "Polygon" &&
    Array.isArray(geometria.coordinates) &&
    geometria.coordinates.every(
      (anillo) => Array.isArray(anillo) && anillo.every((p) => Array.isArray(p) && p.length >= 2 && p.every(Number.isFinite)),
    )
  );
}
