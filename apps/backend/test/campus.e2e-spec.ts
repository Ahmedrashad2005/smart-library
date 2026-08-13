import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { BookCopyStatus } from '@prisma/client';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('Phase 5.1 NAWA Campus location and inventory', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken = '';
  let librarianToken = '';
  let memberToken = '';
  const api = () => request(app.getHttpServer());
  const login = async (email: string) =>
    (await api().post('/api/v1/auth/login').send({ email, password: 'SmartLib123' })).body
      .accessToken as string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    prisma = app.get(PrismaService);
    adminToken = await login('admin@smart-library.test');
    librarianToken = await login('librarian1@smart-library.test');
    memberToken = await login('member1@smart-library.test');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('seeds the one real College Library without a fictional building', async () => {
    const library = await prisma.library.findUnique({ where: { code: 'NAWA-COLLEGE-LIBRARY' } });
    expect(library).toMatchObject({ nameAr: 'مكتبة الكلية', building: null, isActive: true });
    expect(await prisma.library.count({ where: { code: 'NAWA-COLLEGE-LIBRARY' } })).toBe(1);
  });

  it('seeds Floor 3 in the real College Library', async () => {
    const floor = await prisma.libraryFloor.findFirst({
      where: { floorNumber: 3, library: { code: 'NAWA-COLLEGE-LIBRARY' } },
    });
    expect(floor).toMatchObject({ nameAr: 'الدور الثالث', isActive: true });
  });

  it('seeds Room 315 under Floor 3', async () => {
    const room = await prisma.libraryRoom.findFirst({
      where: {
        roomNumber: '315',
        floor: { floorNumber: 3, library: { code: 'NAWA-COLLEGE-LIBRARY' } },
      },
    });
    expect(room).toMatchObject({ nameAr: 'غرفة 315', isActive: true });
  });

  it('accounts for exactly 23 source rows with one Campus copy each', async () => {
    const copies = await prisma.bookCopy.findMany({
      where: { sourceInventoryReference: { startsWith: 'NAWA-CAMPUS-PDF-' } },
      select: { sourceInventoryReference: true, bookId: true },
    });
    expect(copies).toHaveLength(23);
    expect(new Set(copies.map((copy) => copy.sourceInventoryReference)).size).toBe(23);
    expect(new Set(copies.map((copy) => copy.bookId)).size).toBe(23);
  });

  it('resolves Operating System Concepts to Floor 3, Room 315, and source shelf 2/1', async () => {
    const book = await prisma.book.findFirstOrThrow({
      where: { title: 'Operating System Concepts' },
      include: {
        authors: { include: { author: true } },
        copies: {
          where: { sourceInventoryReference: { not: null } },
          include: { homeLibraryRoom: { include: { floor: true } } },
        },
      },
    });
    expect(book).toMatchObject({ publicationYear: 2016, sourcePublicationInfo: 'India' });
    expect(book.authors.map(({ author }) => author.name)).toContain('SILBERSCHATZ, ABRAHAM');
    expect(book.copies[0]).toMatchObject({
      shelfLocationCode: '2/1',
      sourceCollection: 'AI / General Programming / ML-DL / Processing',
      homeLibraryRoom: { roomNumber: '315', floor: { floorNumber: 3 } },
    });
  });

  it('preserves the Big Java shelf code 1,2/1 exactly', async () => {
    const copy = await prisma.bookCopy.findFirstOrThrow({
      where: { book: { title: 'Big Java' }, sourceInventoryReference: { not: null } },
    });
    expect(copy.shelfLocationCode).toBe('1,2/1');
  });

  it('preserves missing publication information and year without fabrication', async () => {
    const wireless = await prisma.book.findFirstOrThrow({
      where: { title: 'Wireless Communications' },
    });
    const biomedical = await prisma.book.findFirstOrThrow({
      where: { title: 'Introduction to Biomedical Engineering' },
    });
    expect(wireless.sourcePublicationInfo).toBeNull();
    expect(wireless.publisherId).toBeNull();
    expect(biomedical.publicationYear).toBeNull();
    expect(biomedical.ddc).toBe('621');
  });

  it('preserves explicit source groups without classifying ungrouped rows', async () => {
    const [cyber, bio, ai, ungrouped] = await Promise.all([
      prisma.bookCopy.findFirstOrThrow({ where: { book: { title: 'Wireless Communications' } } }),
      prisma.bookCopy.findFirstOrThrow({
        where: { book: { title: 'Introduction to Biomedical Engineering' } },
      }),
      prisma.bookCopy.findFirstOrThrow({ where: { book: { title: 'Big Java' } } }),
      prisma.bookCopy.findFirstOrThrow({ where: { book: { title: 'Calculus' } } }),
    ]);
    expect(cyber.sourceCollection).toBe('Cyber Security / Communication');
    expect(bio.sourceCollection).toBe('Bio Informatics');
    expect(ai.sourceCollection).toBe('AI / General Programming / ML-DL / Processing');
    expect(ungrouped.sourceCollection).toBeNull();
  });

  it('returns safe Campus location from the public Book Details API', async () => {
    const response = await api().get(
      '/api/v1/books/slug/campus-source-17-operating-system-concepts',
    );
    expect(response.status).toBe(200);
    expect(response.body.campusAvailability).toMatchObject({
      hasPhysicalCopies: true,
      totalCopies: 1,
      availableCopies: 1,
      availabilityStatus: 'AVAILABLE',
    });
    expect(response.body.campusAvailability.copies[0].campusLocation).toMatchObject({
      library: { nameAr: 'مكتبة الكلية' },
      floor: { number: 3, nameAr: 'الدور الثالث' },
      room: { number: '315', nameAr: 'غرفة 315' },
      shelfLocationCode: '2/1',
      sourceCollection: 'AI / General Programming / ML-DL / Processing',
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('sourceInventoryReference');
    expect(serialized).not.toContain('qrCodeValue');
    expect(serialized).not.toContain('barcode');
    expect(serialized).not.toContain('passwordHash');
  });

  it('lists only safe Campus books with search, pagination, collections, and availability', async () => {
    const page = await api().get('/api/v1/books?campus=true&page=1&limit=5');
    expect(page.status).toBe(200);
    expect(page.body).toMatchObject({ total: 23, page: 1, limit: 5, totalPages: 5 });
    expect(page.body.items).toHaveLength(5);
    expect(page.body.sourceCollections).toEqual([
      'AI / General Programming / ML-DL / Processing',
      'Bio Informatics',
      'Cyber Security / Communication',
    ]);
    expect(
      page.body.items.every(
        (book: { campusAvailability: { hasPhysicalCopies: boolean } }) =>
          book.campusAvailability.hasPhysicalCopies,
      ),
    ).toBe(true);
    expect(JSON.stringify(page.body)).not.toContain('sourceInventoryReference');

    const search = await api().get('/api/v1/books?campus=true&q=Big%20Java');
    expect(search.body).toMatchObject({ total: 1 });
    expect(search.body.items[0]).toMatchObject({
      title: 'Big Java',
      campusAvailability: { totalCopies: 1, availableCopies: 1 },
    });

    const copy = await prisma.bookCopy.findFirstOrThrow({
      where: { book: { title: 'Big Java' }, sourceInventoryReference: { not: null } },
    });
    try {
      await api()
        .patch(`/api/v1/book-copies/${copy.id}/status`)
        .set('Authorization', `Bearer ${librarianToken}`)
        .send({ status: BookCopyStatus.BORROWED });
      const unavailable = await api().get('/api/v1/books?campus=true&available=true&q=Big%20Java');
      expect(unavailable.body).toMatchObject({ total: 0, items: [] });
    } finally {
      await api()
        .patch(`/api/v1/book-copies/${copy.id}/status`)
        .set('Authorization', `Bearer ${librarianToken}`)
        .send({ status: BookCopyStatus.AVAILABLE });
    }

    const ordinaryCatalog = await api().get('/api/v1/books?limit=1');
    expect(ordinaryCatalog.status).toBe(200);
    expect(ordinaryCatalog.body.items).toHaveLength(1);
  });

  it('allows public and member safe reads without exposing management metadata', async () => {
    const publicLibraries = await api().get('/api/v1/libraries');
    const memberLibraries = await api()
      .get('/api/v1/libraries')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(publicLibraries.status).toBe(200);
    expect(memberLibraries.status).toBe(200);
    expect(publicLibraries.body[0]).toMatchObject({
      code: 'NAWA-COLLEGE-LIBRARY',
      nameAr: 'مكتبة الكلية',
    });
    expect(publicLibraries.body[0]).not.toHaveProperty('createdAt');
    expect(publicLibraries.body[0]).not.toHaveProperty('updatedAt');
  });

  it('keeps a loaned copy home location while reporting it unavailable', async () => {
    const copy = await prisma.bookCopy.findFirstOrThrow({
      where: { book: { title: 'Big Java' }, sourceInventoryReference: { not: null } },
      include: { book: true },
    });
    try {
      const changed = await api()
        .patch(`/api/v1/book-copies/${copy.id}/status`)
        .set('Authorization', `Bearer ${librarianToken}`)
        .send({ status: BookCopyStatus.BORROWED });
      expect(changed.status).toBe(200);
      const detail = await api().get(`/api/v1/books/slug/${copy.book.slug}`);
      expect(detail.body.campusAvailability).toMatchObject({
        availableCopies: 0,
        availabilityStatus: 'UNAVAILABLE',
      });
      expect(detail.body.campusAvailability.copies[0]).toMatchObject({
        status: 'BORROWED',
        campusLocation: {
          floor: { number: 3 },
          room: { number: '315' },
          shelfLocationCode: '1,2/1',
        },
      });
    } finally {
      await api()
        .patch(`/api/v1/book-copies/${copy.id}/status`)
        .set('Authorization', `Bearer ${librarianToken}`)
        .send({ status: BookCopyStatus.AVAILABLE });
    }
  });

  it('protects structural location management with ADMIN RBAC and audit logging', async () => {
    const suffix = Date.now().toString();
    const payload = {
      code: `TEST-CAMPUS-${suffix}`,
      nameEn: `Test Campus ${suffix}`,
      nameAr: `موقع اختبار ${suffix}`,
    };
    expect((await api().post('/api/v1/libraries').send(payload)).status).toBe(401);
    expect(
      (
        await api()
          .post('/api/v1/libraries')
          .set('Authorization', `Bearer ${memberToken}`)
          .send(payload)
      ).status,
    ).toBe(403);
    expect(
      (
        await api()
          .post('/api/v1/libraries')
          .set('Authorization', `Bearer ${librarianToken}`)
          .send(payload)
      ).status,
    ).toBe(403);
    const created = await api()
      .post('/api/v1/libraries')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    expect(created.status).toBe(201);
    expect(
      await prisma.auditLog.count({ where: { entityType: 'library', entityId: created.body.id } }),
    ).toBe(1);
    await prisma.auditLog.deleteMany({
      where: { entityType: 'library', entityId: created.body.id },
    });
    await prisma.library.delete({ where: { id: created.body.id } });
  });
});
