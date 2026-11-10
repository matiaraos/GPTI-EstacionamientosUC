CREATE TABLE "ParkingZone" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ParkingZone_pkey" PRIMARY KEY ("id")
);
