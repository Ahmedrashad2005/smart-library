import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { basename, join, resolve } from 'path';

const prisma = new PrismaClient();
const sourceDirectory = resolve(process.env.BOOK_PREVIEW_SOURCE_DIR ?? '/home/ahmed/Desktop');
const storageDirectory = resolve(
  process.env.BOOK_PREVIEW_STORAGE_DIR ?? resolve(process.cwd(), 'uploads/books/previews'),
);
const maximumBytes = Number(process.env.BOOK_PREVIEW_MAX_MB ?? 20) * 1024 * 1024;

const previews = [
  { slug: 'campus-source-02-physics', file: 'physics .pdf' },
  { slug: 'campus-source-06-introduction-to-radar-systems', file: 'Radar System .pdf' },
  { slug: 'campus-source-09-antenna-theory', file: 'Antenna theory .pdf' },
  {
    slug: 'campus-source-16-introduction-to-biomedical-engineering',
    file: 'introductiontobio.pdf',
  },
  { slug: 'campus-source-22-programming-language', file: 'the c++.pdf' },
] as const;

async function main(): Promise<void> {
  await mkdir(storageDirectory, { recursive: true });
  const actor = await prisma.user.findUnique({ where: { email: 'librarian1@smart-library.test' } });
  const snapshot = await prisma.book.findMany({
    where: { slug: { in: previews.map(({ slug }) => slug) } },
    select: {
      id: true,
      slug: true,
      previewPdfKey: true,
      totalCopies: true,
      availableCopies: true,
    },
  });
  if (snapshot.length !== previews.length) {
    const found = new Set(snapshot.map(({ slug }) => slug));
    throw new Error(
      `Seed the Campus catalog first. Missing books: ${previews
        .filter(({ slug }) => !found.has(slug))
        .map(({ slug }) => slug)
        .join(', ')}`,
    );
  }
  for (const preview of previews) {
    const sourcePath = resolve(sourceDirectory, preview.file);
    if (!sourcePath.startsWith(`${sourceDirectory}/`)) throw new Error('Unsafe source filename');
    const contents = await readFile(sourcePath);
    if (!contents.length || contents.subarray(0, 5).toString('ascii') !== '%PDF-')
      throw new Error(`${preview.file} is not a valid PDF`);
    if (contents.length > maximumBytes) throw new Error(`${preview.file} exceeds the size limit`);
    const book = snapshot.find(({ slug }) => slug === preview.slug)!;
    const newKey = `${randomUUID()}.pdf`;
    const target = join(storageDirectory, newKey);
    await writeFile(target, contents, { flag: 'wx', mode: 0o600 });
    try {
      await prisma.$transaction(async (tx) => {
        await tx.book.update({
          where: { id: book.id },
          data: {
            previewPdfKey: newKey,
            previewPdfOriginalName: basename(preview.file),
            previewPdfMimeType: 'application/pdf',
            previewPdfSize: contents.length,
            previewPdfUpdatedAt: new Date(),
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor?.id,
            action: book.previewPdfKey ? 'REPLACE_PREVIEW_PDF' : 'UPLOAD_PREVIEW_PDF',
            entityType: 'book',
            entityId: book.id,
            newValues: { source: 'approved-local-preview-import', size: contents.length },
          },
        });
      });
    } catch (error) {
      await unlink(target).catch(() => undefined);
      throw error;
    }
    if (book.previewPdfKey) {
      await unlink(join(storageDirectory, book.previewPdfKey)).catch(() => undefined);
    }
  }
  const after = await prisma.book.findMany({
    where: { slug: { in: previews.map(({ slug }) => slug) } },
    select: { slug: true, totalCopies: true, availableCopies: true, previewPdfSize: true },
    orderBy: { slug: 'asc' },
  });
  for (const before of snapshot) {
    const current = after.find(({ slug }) => slug === before.slug)!;
    if (
      current.totalCopies !== before.totalCopies ||
      current.availableCopies !== before.availableCopies
    )
      throw new Error(`Inventory counters changed unexpectedly for ${before.slug}`);
  }
  process.stdout.write(`${JSON.stringify(after, null, 2)}\n`);
}

void main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
