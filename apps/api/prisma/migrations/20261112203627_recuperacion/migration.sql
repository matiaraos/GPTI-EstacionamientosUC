-- CreateTable
CREATE TABLE "Recuperacion" (
    "id" SERIAL NOT NULL,
    "cuentaId" INTEGER NOT NULL,
    "hashToken" TEXT NOT NULL,
    "creadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "venceEn" TIMESTAMPTZ(3) NOT NULL,
    "usadoEn" TIMESTAMPTZ(3),

    CONSTRAINT "Recuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Recuperacion_hashToken_key" ON "Recuperacion"("hashToken");

-- CreateIndex
CREATE INDEX "Recuperacion_cuentaId_idx" ON "Recuperacion"("cuentaId");

-- AddForeignKey
ALTER TABLE "Recuperacion" ADD CONSTRAINT "Recuperacion_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
