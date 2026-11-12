-- CreateEnum
CREATE TYPE "TipoAjuste" AS ENUM ('ausencia', 'vencimiento', 'salida_a_tiempo', 'salida_tardia', 'rectificacion');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstadoReserva" ADD VALUE 'ausente';
ALTER TYPE "EstadoReserva" ADD VALUE 'vencida';

-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "vencidaEn" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "AjusteRanking" (
    "id" SERIAL NOT NULL,
    "cuentaId" INTEGER NOT NULL,
    "reservaId" INTEGER,
    "autorRectificacionId" INTEGER,
    "tipo" "TipoAjuste" NOT NULL,
    "claveOrigen" TEXT NOT NULL,
    "variacion" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "registradoEn" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AjusteRanking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AjusteRanking_claveOrigen_key" ON "AjusteRanking"("claveOrigen");

-- CreateIndex
CREATE INDEX "AjusteRanking_cuentaId_registradoEn_idx" ON "AjusteRanking"("cuentaId", "registradoEn");

-- CreateIndex
CREATE INDEX "AjusteRanking_reservaId_idx" ON "AjusteRanking"("reservaId");

-- CreateIndex
CREATE INDEX "AjusteRanking_autorRectificacionId_idx" ON "AjusteRanking"("autorRectificacionId");

-- AddForeignKey
ALTER TABLE "AjusteRanking" ADD CONSTRAINT "AjusteRanking_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjusteRanking" ADD CONSTRAINT "AjusteRanking_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjusteRanking" ADD CONSTRAINT "AjusteRanking_autorRectificacionId_fkey" FOREIGN KEY ("autorRectificacionId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
