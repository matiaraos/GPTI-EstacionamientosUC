-- CreateEnum
CREATE TYPE "EstadoIncidente" AS ENUM ('pendiente', 'validado', 'descartado', 'cerrado');

-- AlterEnum
ALTER TYPE "TipoAjuste" ADD VALUE 'incidente';

-- AlterTable
ALTER TABLE "AjusteRanking" ADD COLUMN     "incidenteId" INTEGER;

-- AlterTable
ALTER TABLE "BloqueoPlaza" ADD COLUMN     "incidenteId" INTEGER;

-- CreateTable
CREATE TABLE "Incidente" (
    "id" SERIAL NOT NULL,
    "plazaId" INTEGER NOT NULL,
    "reservaId" INTEGER,
    "estado" "EstadoIncidente" NOT NULL DEFAULT 'pendiente',
    "descripcion" TEXT NOT NULL,
    "reportadoEn" TIMESTAMPTZ(3) NOT NULL,
    "reportadoPorId" INTEGER NOT NULL,
    "resueltoPorId" INTEGER,
    "motivoResolucion" TEXT,
    "resueltoEn" TIMESTAMPTZ(3),
    "cerradoEn" TIMESTAMPTZ(3),

    CONSTRAINT "Incidente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Incidente_estado_reportadoEn_idx" ON "Incidente"("estado", "reportadoEn");

-- CreateIndex
CREATE INDEX "Incidente_plazaId_idx" ON "Incidente"("plazaId");

-- CreateIndex
CREATE INDEX "Incidente_reservaId_idx" ON "Incidente"("reservaId");

-- CreateIndex
CREATE INDEX "Incidente_reportadoPorId_idx" ON "Incidente"("reportadoPorId");

-- CreateIndex
CREATE INDEX "Incidente_resueltoPorId_idx" ON "Incidente"("resueltoPorId");

-- CreateIndex
CREATE INDEX "AjusteRanking_incidenteId_idx" ON "AjusteRanking"("incidenteId");

-- CreateIndex
CREATE INDEX "BloqueoPlaza_incidenteId_idx" ON "BloqueoPlaza"("incidenteId");

-- AddForeignKey
ALTER TABLE "BloqueoPlaza" ADD CONSTRAINT "BloqueoPlaza_incidenteId_fkey" FOREIGN KEY ("incidenteId") REFERENCES "Incidente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidente" ADD CONSTRAINT "Incidente_plazaId_fkey" FOREIGN KEY ("plazaId") REFERENCES "Plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidente" ADD CONSTRAINT "Incidente_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidente" ADD CONSTRAINT "Incidente_reportadoPorId_fkey" FOREIGN KEY ("reportadoPorId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidente" ADD CONSTRAINT "Incidente_resueltoPorId_fkey" FOREIGN KEY ("resueltoPorId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjusteRanking" ADD CONSTRAINT "AjusteRanking_incidenteId_fkey" FOREIGN KEY ("incidenteId") REFERENCES "Incidente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

