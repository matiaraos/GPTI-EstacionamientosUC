-- CreateTable
CREATE TABLE "BloqueoPlaza" (
    "id" SERIAL NOT NULL,
    "plazaId" INTEGER NOT NULL,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fin" TIMESTAMPTZ(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "creadoPorId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "levantadoEn" TIMESTAMPTZ(3),

    CONSTRAINT "BloqueoPlaza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutorizacionPreferente" (
    "cuentaId" INTEGER NOT NULL,
    "vigenteHasta" TIMESTAMPTZ(3) NOT NULL,
    "revocadaEn" TIMESTAMPTZ(3),
    "otorgadaEn" TIMESTAMPTZ(3) NOT NULL,
    "otorgadaPorId" INTEGER NOT NULL,

    CONSTRAINT "AutorizacionPreferente_pkey" PRIMARY KEY ("cuentaId")
);

-- CreateIndex
CREATE INDEX "BloqueoPlaza_plazaId_inicio_idx" ON "BloqueoPlaza"("plazaId", "inicio");

-- CreateIndex
CREATE INDEX "AutorizacionPreferente_otorgadaPorId_idx" ON "AutorizacionPreferente"("otorgadaPorId");

-- AddForeignKey
ALTER TABLE "BloqueoPlaza" ADD CONSTRAINT "BloqueoPlaza_plazaId_fkey" FOREIGN KEY ("plazaId") REFERENCES "Plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloqueoPlaza" ADD CONSTRAINT "BloqueoPlaza_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutorizacionPreferente" ADD CONSTRAINT "AutorizacionPreferente_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutorizacionPreferente" ADD CONSTRAINT "AutorizacionPreferente_otorgadaPorId_fkey" FOREIGN KEY ("otorgadaPorId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Intervalos [inicio, fin) válidos.
ALTER TABLE "BloqueoPlaza" ADD CONSTRAINT "BloqueoPlaza_intervalo_valido" CHECK ("fin" > "inicio");
