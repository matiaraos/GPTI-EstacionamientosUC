-- CreateEnum
CREATE TYPE "OrigenBloque" AS ENUM ('manual', 'ics', 'uc');

-- AlterTable
ALTER TABLE "BloqueClase" ADD COLUMN     "actividadUCId" INTEGER,
ADD COLUMN     "origen" "OrigenBloque" NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "CursoUC" (
    "id" SERIAL NOT NULL,
    "semestre" TEXT NOT NULL,
    "nrc" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "seccion" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "creditos" INTEGER NOT NULL,

    CONSTRAINT "CursoUC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActividadUC" (
    "id" SERIAL NOT NULL,
    "cursoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "modulos" TEXT NOT NULL,
    "dias" INTEGER[],
    "numeros" INTEGER[],
    "sala" TEXT,
    "destinoId" INTEGER,

    CONSTRAINT "ActividadUC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfilUC" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "carrera" TEXT NOT NULL,
    "nrcs" TEXT[],

    CONSTRAINT "PerfilUC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConexionUC" (
    "cuentaId" INTEGER NOT NULL,
    "perfilId" INTEGER NOT NULL,
    "nrcs" TEXT[],
    "conectadaEn" TIMESTAMPTZ(3) NOT NULL,
    "sincronizadaEn" TIMESTAMPTZ(3),

    CONSTRAINT "ConexionUC_pkey" PRIMARY KEY ("cuentaId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CursoUC_nrc_key" ON "CursoUC"("nrc");

-- CreateIndex
CREATE INDEX "CursoUC_sigla_idx" ON "CursoUC"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "CursoUC_semestre_sigla_seccion_key" ON "CursoUC"("semestre", "sigla", "seccion");

-- CreateIndex
CREATE INDEX "ActividadUC_cursoId_idx" ON "ActividadUC"("cursoId");

-- CreateIndex
CREATE INDEX "ActividadUC_destinoId_idx" ON "ActividadUC"("destinoId");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilUC_codigo_key" ON "PerfilUC"("codigo");

-- CreateIndex
CREATE INDEX "ConexionUC_perfilId_idx" ON "ConexionUC"("perfilId");

-- CreateIndex
CREATE INDEX "BloqueClase_actividadUCId_idx" ON "BloqueClase"("actividadUCId");

-- AddForeignKey
ALTER TABLE "BloqueClase" ADD CONSTRAINT "BloqueClase_actividadUCId_fkey" FOREIGN KEY ("actividadUCId") REFERENCES "ActividadUC"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActividadUC" ADD CONSTRAINT "ActividadUC_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "CursoUC"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActividadUC" ADD CONSTRAINT "ActividadUC_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "Destino"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConexionUC" ADD CONSTRAINT "ConexionUC_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConexionUC" ADD CONSTRAINT "ConexionUC_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "PerfilUC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

