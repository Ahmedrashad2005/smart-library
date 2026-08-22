-- Book preview PDFs are stored outside PostgreSQL. Only safe storage metadata is
-- attached to the bibliographic Book record.
ALTER TABLE "Book"
ADD COLUMN "previewPdfKey" TEXT,
ADD COLUMN "previewPdfOriginalName" TEXT,
ADD COLUMN "previewPdfMimeType" TEXT,
ADD COLUMN "previewPdfSize" INTEGER,
ADD COLUMN "previewPdfUpdatedAt" TIMESTAMP(3);
