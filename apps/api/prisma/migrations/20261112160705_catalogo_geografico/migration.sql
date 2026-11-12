-- CreateEnum
CREATE TYPE "TipoDestino" AS ENUM ('sala', 'edificio');

-- CreateEnum
CREATE TYPE "MetodoDistancia" AS ENUM ('peatonal', 'linea_recta');

-- CreateEnum
CREATE TYPE "TipoPlaza" AS ENUM ('regular', 'preferente');

-- RenameTable: la tabla de zonas de la migración inicial pasa a llamarse "Zona" y conserva sus filas.
ALTER TABLE "ParkingZone" RENAME TO "Zona";
ALTER TABLE "Zona" RENAME CONSTRAINT "ParkingZone_pkey" TO "Zona_pkey";
ALTER SEQUENCE "ParkingZone_id_seq" RENAME TO "Zona_id_seq";
ALTER TABLE "Zona" RENAME COLUMN "name" TO "nombre";
ALTER TABLE "Zona" RENAME COLUMN "active" TO "activa";
ALTER TABLE "Zona" ADD COLUMN "idOrigen" TEXT,
ADD COLUMN "acceso" TEXT,
ADD COLUMN "geometria" JSONB;

-- CreateTable
CREATE TABLE "Campus" (
    "id" SERIAL NOT NULL,
    "idOrigen" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "perimetro" JSONB NOT NULL,

    CONSTRAINT "Campus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Destino" (
    "id" SERIAL NOT NULL,
    "idOrigen" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoDestino" NOT NULL,
    "pisos" INTEGER[],
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Destino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CercaniaBloque" (
    "zonaId" INTEGER NOT NULL,
    "destinoId" INTEGER NOT NULL,
    "metros" INTEGER NOT NULL,
    "metodo" "MetodoDistancia" NOT NULL,
    "conexionBloque" TEXT,
    "conexionDestino" TEXT,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "CercaniaBloque_pkey" PRIMARY KEY ("zonaId","destinoId")
);

-- CreateTable
CREATE TABLE "HorarioZona" (
    "id" SERIAL NOT NULL,
    "zonaId" INTEGER NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "abreMinuto" INTEGER NOT NULL,
    "cierraMinuto" INTEGER NOT NULL,

    CONSTRAINT "HorarioZona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plaza" (
    "id" SERIAL NOT NULL,
    "zonaId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoPlaza" NOT NULL DEFAULT 'regular',
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Plaza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrPlaza" (
    "id" SERIAL NOT NULL,
    "plazaId" INTEGER NOT NULL,
    "identificador" TEXT NOT NULL,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocadoEn" TIMESTAMPTZ(3),

    CONSTRAINT "QrPlaza_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Zona_idOrigen_key" ON "Zona"("idOrigen");

-- CreateIndex
CREATE UNIQUE INDEX "Campus_idOrigen_key" ON "Campus"("idOrigen");

-- CreateIndex
CREATE UNIQUE INDEX "Destino_idOrigen_key" ON "Destino"("idOrigen");

-- CreateIndex
CREATE INDEX "Destino_nombre_idx" ON "Destino"("nombre");

-- CreateIndex
CREATE INDEX "CercaniaBloque_destinoId_metodo_metros_idx" ON "CercaniaBloque"("destinoId", "metodo", "metros");

-- CreateIndex
CREATE UNIQUE INDEX "HorarioZona_zonaId_diaSemana_key" ON "HorarioZona"("zonaId", "diaSemana");

-- CreateIndex
CREATE UNIQUE INDEX "Plaza_zonaId_codigo_key" ON "Plaza"("zonaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "QrPlaza_identificador_key" ON "QrPlaza"("identificador");

-- CreateIndex
CREATE INDEX "QrPlaza_plazaId_idx" ON "QrPlaza"("plazaId");

-- AddForeignKey
ALTER TABLE "CercaniaBloque" ADD CONSTRAINT "CercaniaBloque_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "Zona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CercaniaBloque" ADD CONSTRAINT "CercaniaBloque_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "Destino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorarioZona" ADD CONSTRAINT "HorarioZona_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "Zona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plaza" ADD CONSTRAINT "Plaza_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "Zona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrPlaza" ADD CONSTRAINT "QrPlaza_plazaId_fkey" FOREIGN KEY ("plazaId") REFERENCES "Plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Una plaza tiene como máximo un QR vigente; los revocados se conservan.
CREATE UNIQUE INDEX "QrPlaza_plazaId_vigente_key" ON "QrPlaza"("plazaId") WHERE "revocadoEn" IS NULL;
