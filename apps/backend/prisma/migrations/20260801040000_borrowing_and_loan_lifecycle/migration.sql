CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'RETURNED', 'OVERDUE');

CREATE TABLE "Loan" (
    "id" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "bookCopyId" UUID NOT NULL,
    "borrowedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "renewedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedById" UUID NOT NULL,
    "returnedById" UUID,
    "lastRenewedAt" TIMESTAMP(3),
    "returnCondition" "BookCopyCondition",
    "returnNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Loan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Loan_bookCopyId_fkey" FOREIGN KEY ("bookCopyId") REFERENCES "BookCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Loan_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Loan_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Loan_memberId_returnedAt_dueAt_idx" ON "Loan"("memberId", "returnedAt", "dueAt");
CREATE INDEX "Loan_bookCopyId_returnedAt_idx" ON "Loan"("bookCopyId", "returnedAt");
CREATE INDEX "Loan_status_dueAt_idx" ON "Loan"("status", "dueAt");
