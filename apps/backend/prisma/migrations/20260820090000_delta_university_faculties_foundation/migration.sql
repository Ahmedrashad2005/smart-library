CREATE TABLE "Faculty" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookFaculty" (
    "bookId" UUID NOT NULL,
    "facultyId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookFaculty_pkey" PRIMARY KEY ("bookId", "facultyId")
);

CREATE UNIQUE INDEX "Faculty_slug_key" ON "Faculty"("slug");
CREATE UNIQUE INDEX "Faculty_nameAr_key" ON "Faculty"("nameAr");
CREATE INDEX "Faculty_isActive_displayOrder_idx" ON "Faculty"("isActive", "displayOrder");
CREATE INDEX "BookFaculty_facultyId_idx" ON "BookFaculty"("facultyId");

ALTER TABLE "BookFaculty"
ADD CONSTRAINT "BookFaculty_bookId_fkey"
FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookFaculty"
ADD CONSTRAINT "BookFaculty_facultyId_fkey"
FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Only the 13 faculties confirmed by Delta University material are installed.
-- Official English labels and faculty #14 remain intentionally unpopulated until confirmed.
INSERT INTO "Faculty" (
    "id", "slug", "nameAr", "nameEn", "displayOrder", "isActive", "createdAt", "updatedAt"
) VALUES
    ('40000000-0000-4000-8000-000000000001', 'medicine', 'كلية الطب البشري', NULL, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('40000000-0000-4000-8000-000000000002', 'oral-and-dental-medicine', 'كلية طب الفم والأسنان', NULL, 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('40000000-0000-4000-8000-000000000003', 'veterinary-medicine', 'كلية الطب البيطري', NULL, 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('40000000-0000-4000-8000-000000000004', 'physical-therapy', 'كلية العلاج الطبيعي', NULL, 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('40000000-0000-4000-8000-000000000005', 'pharmacy', 'كلية الصيدلة', NULL, 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('40000000-0000-4000-8000-000000000006', 'health-sciences-technology', 'كلية تكنولوجيا العلوم الصحية', NULL, 6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('40000000-0000-4000-8000-000000000007', 'nursing', 'كلية التمريض', NULL, 7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('40000000-0000-4000-8000-000000000008', 'energy-and-petroleum-engineering', 'كلية هندسة الطاقة والبترول', NULL, 8, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('40000000-0000-4000-8000-000000000009', 'engineering', 'كلية الهندسة', NULL, 9, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('40000000-0000-4000-8000-000000000010', 'artificial-intelligence', 'كلية الذكاء الاصطناعي', NULL, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('40000000-0000-4000-8000-000000000011', 'law', 'كلية الحقوق', NULL, 11, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('40000000-0000-4000-8000-000000000012', 'management', 'كلية الإدارة', NULL, 12, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('40000000-0000-4000-8000-000000000013', 'arts', 'كلية الآداب', NULL, 13, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
