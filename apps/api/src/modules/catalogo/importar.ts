import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Prisma } from "../../generated/prisma/client.js";
import type { Database } from "../../lib/prisma.js";

type Feature = {
  properties: { id: string; nombre: string; tipo: string; pisos?: number[]; acceso?: string };
  geometry: Prisma.InputJsonObject & { type: string };
};

type FilaCercania = {
  destino: string;
  bloque: string;
  metros: number;
  metodo: "peatonal" | "linea_recta";
  conexionBloque: string | null;
  conexionDestino: string | null;
  orden: number;
};

export type FuentesCatalogo = {
  features: Feature[];
  cercanias: FilaCercania[];
};

export type ResumenImportacion = { zonas: number; destinos: number; cercanias: number };

/** Lee un CSV sin comillas (los archivos del catálogo solo tienen identificadores y números). */
function leerCsv(texto: string, columnaDestino: string): FilaCercania[] {
  const [encabezado, ...lineas] = texto.trim().split(/\r?\n/);
  const columnas = encabezado.split(",");
  const conexionDestino = columnas.find((columna) => columna.startsWith("conexion_") && columna !== "conexion_bloque");
  return lineas.map((linea) => {
    const valores = Object.fromEntries(linea.split(",").map((valor, i) => [columnas[i], valor]));
    const metodo = valores.metodo;
    if (metodo !== "peatonal" && metodo !== "linea_recta") {
      throw new Error(`Método de distancia desconocido: ${metodo}`);
    }
    return {
      destino: valores[columnaDestino],
      bloque: valores.bloque,
      metros: Number(valores.metros),
      metodo,
      conexionBloque: valores.conexion_bloque || null,
      conexionDestino: (conexionDestino && valores[conexionDestino]) || null,
      orden: Number(valores.orden),
    };
  });
}

/** `docs/campus-san-joaquin` del repo, tanto desde `src` como desde `dist`. */
export const directorioCatalogo =
  process.env.CATALOGO_DIR ?? fileURLToPath(new URL("../../../../../docs/campus-san-joaquin", import.meta.url));

/** Lee el GeoJSON y los CSV de `docs/campus-san-joaquin`. */
export async function leerFuentesCatalogo(directorio: string): Promise<FuentesCatalogo> {
  const [geojson, salas, edificios] = await Promise.all([
    readFile(path.join(directorio, "catalogo.geojson"), "utf8"),
    readFile(path.join(directorio, "distancias.csv"), "utf8"),
    readFile(path.join(directorio, "distancias-edificios.csv"), "utf8"),
  ]);
  return {
    features: JSON.parse(geojson).features,
    cercanias: [...leerCsv(salas, "sala"), ...leerCsv(edificios, "edificio")],
  };
}

/**
 * Carga bloques, salas, edificios y distancias de forma idempotente: cada registro se identifica
 * por su ID de origen, así que repetir la carga actualiza sin duplicar y conserva los IDs internos.
 * Los accesos vehiculares no se cargan, por lo que nunca son bloques reservables.
 */
export async function importarCatalogo(db: Database, fuentes: FuentesCatalogo): Promise<ResumenImportacion> {
  const porTipo = (tipo: string) => fuentes.features.filter((feature) => feature.properties.tipo === tipo);
  const bloques = porTipo("bloque");
  const destinos = [...porTipo("sala"), ...porTipo("edificio")].map((feature) => ({
    id: feature.properties.id,
    nombre: feature.properties.nombre,
    tipo: feature.properties.tipo,
    pisos: feature.properties.pisos ?? [],
  }));
  const campus = porTipo("campus")[0];

  return db.$transaction(
    async (tx) => {
      for (const bloque of bloques) {
        const datos = {
          nombre: bloque.properties.nombre,
          acceso: bloque.properties.acceso ?? null,
          geometria: bloque.geometry,
        };
        await tx.zona.upsert({
          where: { idOrigen: bloque.properties.id },
          create: { idOrigen: bloque.properties.id, ...datos },
          update: datos,
        });
      }

      if (campus) {
        const datos = { nombre: campus.properties.nombre, perimetro: campus.geometry };
        await tx.campus.upsert({
          where: { idOrigen: campus.properties.id },
          create: { idOrigen: campus.properties.id, ...datos },
          update: datos,
        });
      }

      await tx.$executeRaw`
        INSERT INTO "Destino" ("idOrigen", "nombre", "tipo", "pisos")
        SELECT d->>'id', d->>'nombre', (d->>'tipo')::"TipoDestino",
               ARRAY(SELECT jsonb_array_elements_text(d->'pisos'))::int[]
        FROM jsonb_array_elements(${JSON.stringify(destinos)}::jsonb) AS d
        ON CONFLICT ("idOrigen") DO UPDATE
        SET "nombre" = EXCLUDED."nombre", "tipo" = EXCLUDED."tipo", "pisos" = EXCLUDED."pisos"`;

      const cercanias = await tx.$executeRaw`
        INSERT INTO "CercaniaBloque"
          ("zonaId", "destinoId", "metros", "metodo", "conexionBloque", "conexionDestino", "orden")
        SELECT z."id", d."id", (c->>'metros')::int, (c->>'metodo')::"MetodoDistancia",
               c->>'conexionBloque', c->>'conexionDestino', (c->>'orden')::int
        FROM jsonb_array_elements(${JSON.stringify(fuentes.cercanias)}::jsonb) AS c
        JOIN "Zona" z ON z."idOrigen" = c->>'bloque'
        JOIN "Destino" d ON d."idOrigen" = c->>'destino'
        ON CONFLICT ("zonaId", "destinoId") DO UPDATE
        SET "metros" = EXCLUDED."metros", "metodo" = EXCLUDED."metodo",
            "conexionBloque" = EXCLUDED."conexionBloque", "conexionDestino" = EXCLUDED."conexionDestino",
            "orden" = EXCLUDED."orden"`;

      return { zonas: bloques.length, destinos: destinos.length, cercanias };
    },
    { timeout: 30_000 },
  );
}
