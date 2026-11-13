-- CreateEnum
CREATE TYPE "TipoAviso" AS ENUM ('confirmacion', 'cancelacion', 'cambio', 'sin_cupo', 'espera_asignada', 'recordatorio_clase', 'recordatorio_salida');

-- CreateEnum
CREATE TYPE "EstadoAviso" AS ENUM ('pendiente', 'enviando', 'enviado', 'fallido', 'cancelado');

-- CreateEnum
CREATE TYPE "CanalEnvio" AS ENUM ('push', 'correo');

-- CreateTable
CREATE TABLE "CanalAviso" (
    "id" SERIAL NOT NULL,
    "cuentaId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "actualizadoEn" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CanalAviso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aviso" (
    "id" SERIAL NOT NULL,
    "cuentaId" INTEGER NOT NULL,
    "reservaId" INTEGER,
    "tipo" "TipoAviso" NOT NULL,
    "estado" "EstadoAviso" NOT NULL DEFAULT 'pendiente',
    "claveDeduplicacion" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "programadoEn" TIMESTAMPTZ(3) NOT NULL,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL,
    "enviadoEn" TIMESTAMPTZ(3),
    "canal" "CanalEnvio",
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoError" TEXT,

    CONSTRAINT "Aviso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CanalAviso_token_key" ON "CanalAviso"("token");

-- CreateIndex
CREATE INDEX "CanalAviso_cuentaId_idx" ON "CanalAviso"("cuentaId");

-- CreateIndex
CREATE UNIQUE INDEX "Aviso_claveDeduplicacion_key" ON "Aviso"("claveDeduplicacion");

-- CreateIndex
CREATE INDEX "Aviso_estado_programadoEn_idx" ON "Aviso"("estado", "programadoEn");

-- CreateIndex
CREATE INDEX "Aviso_cuentaId_creadoEn_idx" ON "Aviso"("cuentaId", "creadoEn");

-- CreateIndex
CREATE INDEX "Aviso_reservaId_idx" ON "Aviso"("reservaId");

-- AddForeignKey
ALTER TABLE "CanalAviso" ADD CONSTRAINT "CanalAviso_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aviso" ADD CONSTRAINT "Aviso_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aviso" ADD CONSTRAINT "Aviso_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE SET NULL ON UPDATE CASCADE;

