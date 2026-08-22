import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('Book preview PDF', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storageDir = '';
  let bookId = '';
  let slug = '';
  let librarianToken = '';
  let memberToken = '';
  const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
  const api = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'delta-book-previews-'));
    process.env.BOOK_PREVIEW_STORAGE_DIR = storageDir;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    prisma = app.get(PrismaService);
    const login = async (email: string) =>
      (await api().post('/api/v1/auth/login').send({ email, password: 'SmartLib123' })).body
        .accessToken as string;
    librarianToken = await login('librarian1@smart-library.test');
    memberToken = await login('member1@smart-library.test');
    const category = await prisma.category.findFirstOrThrow({ where: { isArchived: false } });
    const author = await prisma.author.findFirstOrThrow({ where: { isArchived: false } });
    slug = `preview-test-${Date.now()}`;
    const book = await prisma.book.create({
      data: {
        title: 'Book Preview Integration Fixture',
        slug,
        categoryId: category.id,
        authors: { create: { authorId: author.id } },
      },
    });
    bookId = book.id;
  });

  afterAll(async () => {
    await prisma.bookAuthor.deleteMany({ where: { bookId } });
    await prisma.book.deleteMany({ where: { id: bookId } });
    await prisma.$disconnect();
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  it('rejects unauthenticated and MEMBER uploads', async () => {
    expect((await api().post(`/api/v1/books/${bookId}/preview-pdf`)).status).toBe(401);
    expect(
      (
        await api()
          .post(`/api/v1/books/${bookId}/preview-pdf`)
          .set(auth(memberToken))
          .attach('file', pdf, { filename: 'preview.pdf', contentType: 'application/pdf' })
      ).status,
    ).toBe(403);
  });

  it('rejects malformed, fake, unsupported, empty, and oversized uploads', async () => {
    const cases = [
      { data: Buffer.from('not pdf'), name: 'fake.pdf', type: 'application/pdf', status: 400 },
      { data: pdf, name: 'preview.txt', type: 'application/pdf', status: 400 },
      { data: pdf, name: 'preview.pdf', type: 'text/plain', status: 400 },
      { data: Buffer.alloc(0), name: 'empty.pdf', type: 'application/pdf', status: 400 },
      {
        data: Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(20 * 1024 * 1024)]),
        name: 'large.pdf',
        type: 'application/pdf',
        status: 413,
      },
    ];
    for (const item of cases) {
      const result = await api()
        .post(`/api/v1/books/${bookId}/preview-pdf`)
        .set(auth(librarianToken))
        .attach('file', item.data, { filename: item.name, contentType: item.type });
      expect(result.status).toBe(item.status);
    }
  });

  it('returns a safe 404 for an unknown Book', async () => {
    const result = await api()
      .post('/api/v1/books/00000000-0000-4000-8000-000000000000/preview-pdf')
      .set(auth(librarianToken))
      .attach('file', pdf, { filename: 'preview.pdf', contentType: 'application/pdf' });
    expect(result.status).toBe(404);
    expect(JSON.stringify(result.body)).not.toContain(storageDir);
  });

  it('allows a LIBRARIAN upload and links safe metadata to the correct Book', async () => {
    const result = await api()
      .post(`/api/v1/books/${bookId}/preview-pdf`)
      .set(auth(librarianToken))
      .attach('file', pdf, { filename: '../Approved Preview.pdf', contentType: 'application/pdf' });
    expect(result.status).toBe(201);
    expect(result.body).toMatchObject({
      available: true,
      url: `/books/${bookId}/preview-pdf`,
      originalName: 'Approved Preview.pdf',
      size: pdf.length,
    });
    expect(JSON.stringify(result.body)).not.toContain('previewPdfKey');
    const stored = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
    expect(stored.previewPdfKey).toMatch(/^[0-9a-f-]{36}\.pdf$/);
  });

  it('reports preview availability without exposing storage internals', async () => {
    for (const path of [`/api/v1/books/${bookId}`, `/api/v1/books/slug/${slug}`]) {
      const result = await api().get(path);
      expect(result.body.preview).toMatchObject({
        available: true,
        url: `/books/${bookId}/preview-pdf`,
      });
      expect(JSON.stringify(result.body)).not.toContain('previewPdfKey');
      expect(JSON.stringify(result.body)).not.toContain(storageDir);
    }
  });

  it('streams an authenticated preview inline with safe headers', async () => {
    expect((await api().get(`/api/v1/books/${bookId}/preview-pdf`)).status).toBe(401);
    const result = await api()
      .get(`/api/v1/books/${bookId}/preview-pdf`)
      .set(auth(memberToken))
      .buffer(true);
    expect(result.status).toBe(200);
    expect(result.headers['content-type']).toContain('application/pdf');
    expect(result.headers['content-disposition']).toContain('inline;');
    expect(result.headers['content-disposition']).not.toContain(storageDir);
  });

  it('replaces a PDF safely and a failed replacement preserves the working asset', async () => {
    const before = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
    const invalid = await api()
      .post(`/api/v1/books/${bookId}/preview-pdf`)
      .set(auth(librarianToken))
      .attach('file', Buffer.from('invalid'), {
        filename: 'replacement.pdf',
        contentType: 'application/pdf',
      });
    expect(invalid.status).toBe(400);
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bookId } })).previewPdfKey).toBe(
      before.previewPdfKey,
    );
    const replacement = Buffer.from('%PDF-1.7\nreplacement\n%%EOF');
    const valid = await api()
      .post(`/api/v1/books/${bookId}/preview-pdf`)
      .set(auth(librarianToken))
      .attach('file', replacement, { filename: 'replacement.pdf', contentType: 'application/pdf' });
    expect(valid.status).toBe(201);
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bookId } })).previewPdfKey).not.toBe(
      before.previewPdfKey,
    );
  });

  it('does not mutate copies, loans, reservations, counters, faculties, or student data', async () => {
    const before = await Promise.all([
      prisma.bookCopy.count({ where: { bookId } }),
      prisma.loan.count({ where: { bookCopy: { bookId } } }),
      prisma.reservation.count({ where: { bookId } }),
      prisma.bookFaculty.count({ where: { bookId } }),
      prisma.user.count(),
    ]);
    const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
    await api()
      .post(`/api/v1/books/${bookId}/preview-pdf`)
      .set(auth(librarianToken))
      .attach('file', pdf, { filename: 'integrity.pdf', contentType: 'application/pdf' });
    expect(
      await Promise.all([
        prisma.bookCopy.count({ where: { bookId } }),
        prisma.loan.count({ where: { bookCopy: { bookId } } }),
        prisma.reservation.count({ where: { bookId } }),
        prisma.bookFaculty.count({ where: { bookId } }),
        prisma.user.count(),
      ]),
    ).toEqual(before);
    const after = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
    expect([after.totalCopies, after.availableCopies, after.coverImageUrl]).toEqual([
      book.totalCopies,
      book.availableCopies,
      book.coverImageUrl,
    ]);
  });

  it('deletes idempotently while keeping the Book valid', async () => {
    const first = await api()
      .delete(`/api/v1/books/${bookId}/preview-pdf`)
      .set(auth(librarianToken));
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ removed: true, preview: { available: false } });
    const second = await api()
      .delete(`/api/v1/books/${bookId}/preview-pdf`)
      .set(auth(librarianToken));
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ removed: false, preview: { available: false } });
    expect((await api().get(`/api/v1/books/${bookId}`)).body.preview.available).toBe(false);
  });
});
