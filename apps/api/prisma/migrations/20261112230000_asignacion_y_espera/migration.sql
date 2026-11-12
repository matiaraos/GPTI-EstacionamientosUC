-- CreateEnum
CREATE TYPE "OrigenDestino" AS ENUM ('horario', 'declarado');

-- CreateEnum
CREATE TYPE "EstadoEspera" AS ENUM ('pendiente', 'asignada', 'cancelada', 'vencida');

-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "destinoDesempateId" INTEGER,
ADD COLUMN     "origenDestino" "OrigenDestino" NOT NULL DEFAULT 'declarado',
ADD COLUMN     "reemplazaId" INTEGER;

-- CreateTable
CREATE TABLE "SolicitudEspera" (
    "id" SERIAL NOT NULL,
    "cuentaId" INTEGER NOT NULL,
    "vehiculoId" INTEGER NOT NULL,
    "destinoId" INTEGER NOT NULL,
    "destinoDesempateId" INTEGER,
    "origenDestino" "OrigenDestino" NOT NULL DEFAULT 'declarado',
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fin" TIMESTAMPTZ(3) NOT NULL,
    "estado" "EstadoEspera" NOT NULL DEFAULT 'pendiente',
    "aceptadaEn" TIMESTAMPTZ(3) NOT NULL,
    "claveIdempotencia" TEXT NOT NULL,
    "reservaId" INTEGER,
    "cerradaEn" TIMESTAMPTZ(3),

    CONSTRAINT "SolicitudEspera_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudEspera_reservaId_key" ON "SolicitudEspera"("reservaId");

-- CreateIndex
CREATE INDEX "SolicitudEspera_estado_inicio_idx" ON "SolicitudEspera"("estado", "inicio");

-- CreateIndex
CREATE INDEX "SolicitudEspera_vehiculoId_idx" ON "SolicitudEspera"("vehiculoId");

-- CreateIndex
CREATE INDEX "SolicitudEspera_destinoId_idx" ON "SolicitudEspera"("destinoId");

-- CreateIndex
CREATE INDEX "SolicitudEspera_destinoDesempateId_idx" ON "SolicitudEspera"("destinoDesempateId");

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudEspera_cuentaId_claveIdempotencia_key" ON "SolicitudEspera"("cuentaId", "claveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_reemplazaId_key" ON "Reserva"("reemplazaId");

-- CreateIndex
CREATE INDEX "Reserva_destinoDesempateId_idx" ON "Reserva"("destinoDesempateId");

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_destinoDesempateId_fkey" FOREIGN KEY ("destinoDesempateId") REFERENCES "Destino"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_reemplazaId_fkey" FOREIGN KEY ("reemplazaId") REFERENCES "Reserva"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudEspera" ADD CONSTRAINT "SolicitudEspera_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudEspera" ADD CONSTRAINT "SolicitudEspera_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudEspera" ADD CONSTRAINT "SolicitudEspera_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "Destino"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudEspera" ADD CONSTRAINT "SolicitudEspera_destinoDesempateId_fkey" FOREIGN KEY ("destinoDesempateId") REFERENCES "Destino"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudEspera" ADD CONSTRAINT "SolicitudEspera_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "SolicitudEspera" ADD CONSTRAINT "SolicitudEspera_intervalo_valido" CHECK ("fin" > "inicio");

-- Una cuenta no mantiene dos esperas pendientes que se solapen.
ALTER TABLE "SolicitudEspera" ADD CONSTRAINT "SolicitudEspera_sin_solape_pendiente"
  EXCLUDE USING gist ("cuentaId" WITH =, tstzrange("inicio", "fin", '[)') WITH &&)
  WHERE ("estado" = 'pendiente');
