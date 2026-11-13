-- CreateEnum
CREATE TYPE "EstadoSerie" AS ENUM ('activa', 'revocada', 'cancelada');

-- AlterEnum
ALTER TYPE "TipoAjuste" ADD VALUE 'revocacion_recurrente';

-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "bloqueSerieId" INTEGER,
ADD COLUMN     "fechaOcurrencia" DATE;

-- CreateTable
CREATE TABLE "SerieReserva" (
    "id" SERIAL NOT NULL,
    "cuentaId" INTEGER NOT NULL,
    "vehiculoId" INTEGER NOT NULL,
    "zonaId" INTEGER NOT NULL,
    "estado" "EstadoSerie" NOT NULL DEFAULT 'activa',
    "claveIdempotencia" TEXT NOT NULL,
    "creadaEn" TIMESTAMPTZ(3) NOT NULL,
    "semanaHasta" DATE NOT NULL,
    "cerradaEn" TIMESTAMPTZ(3),
    "motivoCierre" TEXT,

    CONSTRAINT "SerieReserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloqueSerie" (
    "id" SERIAL NOT NULL,
    "serieId" INTEGER NOT NULL,
    "destinoId" INTEGER NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "inicioMinuto" INTEGER NOT NULL,
    "finMinuto" INTEGER NOT NULL,

    CONSTRAINT "BloqueSerie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SerieReserva_zonaId_estado_idx" ON "SerieReserva"("zonaId", "estado");

-- CreateIndex
CREATE INDEX "SerieReserva_vehiculoId_idx" ON "SerieReserva"("vehiculoId");

-- CreateIndex
CREATE UNIQUE INDEX "SerieReserva_cuentaId_claveIdempotencia_key" ON "SerieReserva"("cuentaId", "claveIdempotencia");

-- CreateIndex
CREATE INDEX "BloqueSerie_serieId_idx" ON "BloqueSerie"("serieId");

-- CreateIndex
CREATE INDEX "BloqueSerie_destinoId_idx" ON "BloqueSerie"("destinoId");

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_bloqueSerieId_fechaOcurrencia_key" ON "Reserva"("bloqueSerieId", "fechaOcurrencia");

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_bloqueSerieId_fkey" FOREIGN KEY ("bloqueSerieId") REFERENCES "BloqueSerie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerieReserva" ADD CONSTRAINT "SerieReserva_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerieReserva" ADD CONSTRAINT "SerieReserva_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerieReserva" ADD CONSTRAINT "SerieReserva_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "Zona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloqueSerie" ADD CONSTRAINT "BloqueSerie_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "SerieReserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloqueSerie" ADD CONSTRAINT "BloqueSerie_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "Destino"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "BloqueSerie" ADD CONSTRAINT "BloqueSerie_intervalo_valido"
  CHECK ("diaSemana" BETWEEN 1 AND 7 AND "inicioMinuto" >= 0 AND "finMinuto" <= 1440 AND "finMinuto" > "inicioMinuto");
