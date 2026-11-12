-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('entrada', 'salida');

-- CreateTable
CREATE TABLE "EventoReserva" (
    "id" SERIAL NOT NULL,
    "reservaId" INTEGER NOT NULL,
    "tipo" "TipoEvento" NOT NULL,
    "qrPlazaId" INTEGER NOT NULL,
    "registradoEn" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EventoReserva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventoReserva_qrPlazaId_idx" ON "EventoReserva"("qrPlazaId");

-- CreateIndex
CREATE UNIQUE INDEX "EventoReserva_reservaId_tipo_key" ON "EventoReserva"("reservaId", "tipo");

-- AddForeignKey
ALTER TABLE "EventoReserva" ADD CONSTRAINT "EventoReserva_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoReserva" ADD CONSTRAINT "EventoReserva_qrPlazaId_fkey" FOREIGN KEY ("qrPlazaId") REFERENCES "QrPlaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ocupación real: solo un uso activo por plaza, cuenta y vehículo. Si la reserva anterior sigue en
-- uso cuando llega la siguiente, el segundo check-in se rechaza y se señala el conflicto.
CREATE UNIQUE INDEX "Reserva_plaza_en_uso_key" ON "Reserva"("plazaId") WHERE "estado" = 'en_uso';
CREATE UNIQUE INDEX "Reserva_cuenta_en_uso_key" ON "Reserva"("cuentaId") WHERE "estado" = 'en_uso';
CREATE UNIQUE INDEX "Reserva_vehiculo_en_uso_key" ON "Reserva"("vehiculoId") WHERE "estado" = 'en_uso';
