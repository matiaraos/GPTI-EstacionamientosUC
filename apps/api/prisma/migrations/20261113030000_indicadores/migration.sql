-- CreateTable
CREATE TABLE "LecturaQR" (
    "id" SERIAL NOT NULL,
    "reservaId" INTEGER NOT NULL,
    "tipo" "TipoEvento" NOT NULL,
    "resultado" TEXT NOT NULL,
    "registradoEn" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LecturaQR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncuestaSatisfaccion" (
    "id" SERIAL NOT NULL,
    "reservaId" INTEGER NOT NULL,
    "puntaje" INTEGER NOT NULL,
    "comentario" TEXT,
    "creadaEn" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EncuestaSatisfaccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicionDisponibilidad" (
    "id" SERIAL NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "porcentaje" DOUBLE PRECISION NOT NULL,
    "fuente" TEXT NOT NULL,
    "simulada" BOOLEAN NOT NULL DEFAULT false,
    "registradaEn" TIMESTAMPTZ(3) NOT NULL,
    "registradaPorId" INTEGER,

    CONSTRAINT "MedicionDisponibilidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultadoPiloto" (
    "id" SERIAL NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "modo" TEXT NOT NULL,
    "generadoEn" TIMESTAMPTZ(3) NOT NULL,
    "indicadores" JSONB NOT NULL,

    CONSTRAINT "ResultadoPiloto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LecturaQR_reservaId_tipo_registradoEn_idx" ON "LecturaQR"("reservaId", "tipo", "registradoEn");

-- CreateIndex
CREATE UNIQUE INDEX "EncuestaSatisfaccion_reservaId_key" ON "EncuestaSatisfaccion"("reservaId");

-- CreateIndex
CREATE INDEX "MedicionDisponibilidad_desde_hasta_idx" ON "MedicionDisponibilidad"("desde", "hasta");

-- CreateIndex
CREATE INDEX "MedicionDisponibilidad_registradaPorId_idx" ON "MedicionDisponibilidad"("registradaPorId");

-- CreateIndex
CREATE INDEX "ResultadoPiloto_desde_hasta_idx" ON "ResultadoPiloto"("desde", "hasta");

-- AddForeignKey
ALTER TABLE "LecturaQR" ADD CONSTRAINT "LecturaQR_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncuestaSatisfaccion" ADD CONSTRAINT "EncuestaSatisfaccion_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicionDisponibilidad" ADD CONSTRAINT "MedicionDisponibilidad_registradaPorId_fkey" FOREIGN KEY ("registradaPorId") REFERENCES "Cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "EncuestaSatisfaccion" ADD CONSTRAINT "EncuestaSatisfaccion_puntaje_valido" CHECK ("puntaje" BETWEEN 1 AND 5);
ALTER TABLE "MedicionDisponibilidad" ADD CONSTRAINT "MedicionDisponibilidad_valida" CHECK ("porcentaje" BETWEEN 0 AND 100 AND "hasta" >= "desde");

-- AlterTable
ALTER TABLE "Cuenta" ADD COLUMN     "simulada" BOOLEAN NOT NULL DEFAULT false;
