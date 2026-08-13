-- CreateTable
CREATE TABLE "Library" (
    "id" UUID NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "descriptionAr" TEXT,
    "building" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryFloor" (
    "id" UUID NOT NULL,
    "libraryId" UUID NOT NULL,
    "floorNumber" INTEGER NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryFloor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryRoom" (
    "id" UUID NOT NULL,
    "floorId" UUID NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "descriptionAr" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryRoom_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "LibrarySection" ADD COLUMN "roomId" UUID;

-- AlterTable
ALTER TABLE "Book"
ADD COLUMN "sourcePublicationInfo" TEXT,
ADD COLUMN "ddc" TEXT;

-- AlterTable
ALTER TABLE "BookCopy"
ADD COLUMN "homeLibraryRoomId" UUID,
ADD COLUMN "shelfLocationCode" TEXT,
ADD COLUMN "sourceInventoryReference" TEXT,
ADD COLUMN "sourceCollection" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Library_code_key" ON "Library"("code");

-- CreateIndex
CREATE INDEX "Library_isActive_idx" ON "Library"("isActive");

-- CreateIndex
CREATE INDEX "LibraryFloor_libraryId_isActive_idx" ON "LibraryFloor"("libraryId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryFloor_libraryId_floorNumber_key" ON "LibraryFloor"("libraryId", "floorNumber");

-- CreateIndex
CREATE INDEX "LibraryRoom_floorId_isActive_idx" ON "LibraryRoom"("floorId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryRoom_floorId_roomNumber_key" ON "LibraryRoom"("floorId", "roomNumber");

-- CreateIndex
CREATE INDEX "LibrarySection_roomId_idx" ON "LibrarySection"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "BookCopy_sourceInventoryReference_key" ON "BookCopy"("sourceInventoryReference");

-- CreateIndex
CREATE INDEX "BookCopy_homeLibraryRoomId_status_isArchived_idx" ON "BookCopy"("homeLibraryRoomId", "status", "isArchived");

-- CreateIndex
CREATE INDEX "BookCopy_shelfLocationCode_idx" ON "BookCopy"("shelfLocationCode");

-- AddForeignKey
ALTER TABLE "LibraryFloor" ADD CONSTRAINT "LibraryFloor_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryRoom" ADD CONSTRAINT "LibraryRoom_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "LibraryFloor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibrarySection" ADD CONSTRAINT "LibrarySection_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "LibraryRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCopy" ADD CONSTRAINT "BookCopy_homeLibraryRoomId_fkey" FOREIGN KEY ("homeLibraryRoomId") REFERENCES "LibraryRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
