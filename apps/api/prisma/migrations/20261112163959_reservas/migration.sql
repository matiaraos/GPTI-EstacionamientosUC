-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('confirmada', 'en_uso', 'finalizada', 'cancelada');

-- CreateTable
CREATE TABLE "Reserva" (
    "id" SERIAL NOT NULL,
    "cuentaId" INTEGER NOT NULL,
    "vehiculoId" INTEGER NOT NULL,
    "plazaId" INTEGER NOT NULL,
    "destinoId" INTEGER NOT NULL,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fin" TIMESTAMPTZ(3) NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'confirmada',
    "claveIdempotencia" TEXT NOT NULL,
    "metros" INTEGER NOT NULL,
    "metodoDistancia" "MetodoDistancia" NOT NULL,
    "creadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceladaEn" TIMESTAMPTZ(3),

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reserva_cuentaId_inicio_idx" ON "Reserva"("cuentaId", "inicio");

-- CreateIndex
CREATE INDEX "Reserva_plazaId_inicio_idx" ON "Reserva"("plazaId", "inicio");

-- CreateIndex
CREATE INDEX "Reserva_vehiculoId_idx" ON "Reserva"("vehiculoId");

-- CreateIndex
CREATE INDEX "Reserva_destinoId_idx" ON "Reserva"("destinoId");

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_cuentaId_claveIdempotencia_key" ON "Reserva"("cuentaId", "claveIdempotencia");

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_plazaId_fkey" FOREIGN KEY ("plazaId") REFERENCES "Plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "Destino"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Intervalos [inicio, fin) válidos.
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_intervalo_valido" CHECK ("fin" > "inicio");

-- Las reservas que ocupan capacidad no se solapan por plaza, cuenta ni vehículo. Con '[)' dos
-- reservas contiguas (una termina cuando empieza la otra) no se consideran solapadas.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_sin_solape_plaza"
  EXCLUDE USING gist ("plazaId" WITH =, tstzrange("inicio", "fin", '[)') WITH &&)
  WHERE ("estado" IN ('confirmada', 'en_uso'));

ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_sin_solape_cuenta"
  EXCLUDE USING gist ("cuentaId" WITH =, tstzrange("inicio", "fin", '[)') WITH &&)
  WHERE ("estado" IN ('confirmada', 'en_uso'));

ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_sin_solape_vehiculo"
  EXCLUDE USING gist ("vehiculoId" WITH =, tstzrange("inicio", "fin", '[)') WITH &&)
  WHERE ("estado" IN ('confirmada', 'en_uso'));
