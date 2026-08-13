-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED', 'COLLECTED');

-- CreateTable
CREATE TABLE "Reservation" (
    "id" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "bookCopyId" UUID NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reservation_memberId_status_expiresAt_idx" ON "Reservation"("memberId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "Reservation_bookId_status_expiresAt_idx" ON "Reservation"("bookId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "Reservation_bookCopyId_status_idx" ON "Reservation"("bookCopyId", "status");

-- CreateIndex
CREATE INDEX "Reservation_status_expiresAt_idx" ON "Reservation"("status", "expiresAt");

-- PostgreSQL partial uniqueness preserves reservation history while preventing
-- more than one ACTIVE reservation for a copy or for the same member and book.
CREATE UNIQUE INDEX "Reservation_active_bookCopyId_key"
ON "Reservation"("bookCopyId")
WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "Reservation_active_memberId_bookId_key"
ON "Reservation"("memberId", "bookId")
WHERE "status" = 'ACTIVE';

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_bookCopyId_fkey" FOREIGN KEY ("bookCopyId") REFERENCES "BookCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
