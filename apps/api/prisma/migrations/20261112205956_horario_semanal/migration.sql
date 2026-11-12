-- CreateTable
CREATE TABLE "BloqueClase" (
    "id" SERIAL NOT NULL,
    "cuentaId" INTEGER NOT NULL,
    "destinoId" INTEGER NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "inicioMinuto" INTEGER NOT NULL,
    "finMinuto" INTEGER NOT NULL,
    "titulo" TEXT,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BloqueClase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BloqueClase_cuentaId_diaSemana_idx" ON "BloqueClase"("cuentaId", "diaSemana");

-- CreateIndex
CREATE INDEX "BloqueClase_destinoId_idx" ON "BloqueClase"("destinoId");

-- AddForeignKey
ALTER TABLE "BloqueClase" ADD CONSTRAINT "BloqueClase_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloqueClase" ADD CONSTRAINT "BloqueClase_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "Destino"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Día de la semana y minutos válidos, intervalo [inicio, fin).
ALTER TABLE "BloqueClase" ADD CONSTRAINT "BloqueClase_dia_valido" CHECK ("diaSemana" BETWEEN 1 AND 7);
ALTER TABLE "BloqueClase" ADD CONSTRAINT "BloqueClase_intervalo_valido"
  CHECK ("inicioMinuto" >= 0 AND "finMinuto" <= 1440 AND "finMinuto" > "inicioMinuto");

-- Los bloques de una persona no se solapan en el mismo día. Bloques contiguos se admiten.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "BloqueClase" ADD CONSTRAINT "BloqueClase_sin_solape"
  EXCLUDE USING gist ("cuentaId" WITH =, "diaSemana" WITH =, int4range("inicioMinuto", "finMinuto", '[)') WITH &&);
