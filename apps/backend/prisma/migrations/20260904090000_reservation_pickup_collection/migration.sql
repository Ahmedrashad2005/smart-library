-- Pickup tokens are one-time credentials. Only their Argon2 hashes are stored.
ALTER TABLE "Reservation"
ADD COLUMN "collectedByUserId" UUID,
ADD COLUMN "pickupTokenHash" TEXT,
ADD COLUMN "pickupTokenExpiresAt" TIMESTAMP(3);

CREATE INDEX "Reservation_pickupTokenExpiresAt_idx"
ON "Reservation"("pickupTokenExpiresAt");

ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_collectedByUserId_fkey"
FOREIGN KEY ("collectedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- A collection can create only one Loan, even if application code regresses.
ALTER TABLE "Loan" ADD COLUMN "reservationId" UUID;

CREATE UNIQUE INDEX "Loan_reservationId_key" ON "Loan"("reservationId");

ALTER TABLE "Loan"
ADD CONSTRAINT "Loan_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
