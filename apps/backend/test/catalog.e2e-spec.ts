import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { CatalogService } from '../src/modules/catalog/catalog.service';

describe('Phase 3 catalog and inventory', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let catalog: CatalogService;
  let adminToken = '';
  let librarianToken = '';
  let memberToken = '';
  const suffix = `test-${Date.now()}`;
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
    catalog = app.get(CatalogService);
    adminToken = await login('admin@smart-library.test');
    librarianToken = await login('librarian1@smart-library.test');
    memberToken = await login('member1@smart-library.test');
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('protects master data while allowing public catalog reads', async () => {
    expect((await api().get('/api/v1/categories')).status).toBe(200);
    expect(
      (
        await api()
          .post('/api/v1/categories')
          .set('Authorization', `Bearer ${memberToken}`)
          .send({ nameEn: 'Denied', nameAr: 'ممنوع', slug: `${suffix}-denied` })
      ).status,
    ).toBe(403);
  });

  it('builds bounded compact semantic candidates and excludes archived books', async () => {
    const category = (await api().get('/api/v1/categories')).body[0];
    const author = (await api().get('/api/v1/authors')).body[0];
    const publisher = (await api().get('/api/v1/publishers')).body[0];
    const created = await api()
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: `000 Semantic Candidate ${suffix}`,
        subtitle: 'A verified catalog subject subtitle',
        slug: `${suffix}-semantic-candidate`,
        ddc: '005.1',
        categoryId: category.id,
        publisherId: publisher.id,
        authorIds: [author.id],
        description: 'D'.repeat(900),
      });
    expect(created.status).toBe(201);
    await prisma.book.update({
      where: { id: created.body.id },
      data: { subtitle: 'A verified catalog subject subtitle' },
    });
    const candidates = await catalog.semanticCatalogCandidates(75);
    const candidate = candidates.find(({ id }) => id === created.body.id);
    expect(candidate).toMatchObject({
      id: created.body.id,
      title: `000 Semantic Candidate ${suffix}`,
      subtitle: 'A verified catalog subject subtitle',
      authors: expect.any(Array),
      categories: expect.any(Array),
      publisher: publisher.nameAr || publisher.name,
      classification: '005.1',
      faculties: expect.any(Array),
    });
    expect(candidate?.description).toHaveLength(420);
    expect(await catalog.semanticCatalogCandidates(2)).toHaveLength(2);
    expect(
      (
        await api()
          .post(`/api/v1/books/${created.body.id}/archive`)
          .set('Authorization', `Bearer ${librarianToken}`)
      ).status,
    ).toBe(201);
    expect(
      (await catalog.semanticCatalogCandidates(75)).some(({ id }) => id === created.body.id),
    ).toBe(false);
    expect(
      (
        await api()
          .post(`/api/v1/books/${created.body.id}/restore`)
          .set('Authorization', `Bearer ${librarianToken}`)
      ).status,
    ).toBe(201);
  });

  it('creates, rejects duplicates, archives and restores master data with audit records', async () => {
    const category = await api()
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nameEn: `Testing ${suffix}`,
        nameAr: `اختبار ${suffix}`,
        slug: `${suffix}-category`,
      });
    expect(category.status).toBe(201);
    expect(
      (
        await api()
          .post('/api/v1/categories')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            nameEn: `Testing ${suffix}`,
            nameAr: `اختبار ${suffix}`,
            slug: `${suffix}-category`,
          })
      ).status,
    ).toBe(400);
    expect(
      (
        await api()
          .post(`/api/v1/categories/${category.body.id}/archive`)
          .set('Authorization', `Bearer ${adminToken}`)
      ).status,
    ).toBe(201);
    expect(
      (
        await api()
          .post(`/api/v1/categories/${category.body.id}/restore`)
          .set('Authorization', `Bearer ${adminToken}`)
      ).status,
    ).toBe(201);
    expect(
      await prisma.auditLog.count({
        where: { entityType: 'category', entityId: category.body.id },
      }),
    ).toBeGreaterThanOrEqual(3);
  });

  it('creates multiple-author books and supports search, filters, pagination, and updates', async () => {
    const category = (await api().get('/api/v1/categories')).body[0];
    const first = await api()
      .post('/api/v1/authors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Author A ${suffix}`, nameAr: `مؤلف أ ${suffix}` });
    const second = await api()
      .post('/api/v1/authors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Author B ${suffix}`, nameAr: `مؤلف ب ${suffix}` });
    const create = await api()
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: `Integration Catalog ${suffix}`,
        titleAr: `فهرس ${suffix}`,
        slug: `${suffix}-book`,
        isbn13: `979${String(Date.now()).slice(-10)}`,
        categoryId: category.id,
        authorIds: [first.body.id, second.body.id],
        language: 'en',
      });
    expect(create.status).toBe(201);
    expect(create.body.authors).toHaveLength(2);
    expect(
      (await api().get(`/api/v1/books?q=${suffix}&categoryId=${category.id}&page=1&limit=1`)).body
        .items,
    ).toHaveLength(1);
    const updated = await api()
      .patch(`/api/v1/books/${create.body.id}`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ title: `Updated ${suffix}`, authorIds: [second.body.id] });
    expect(updated.status).toBe(200);
    expect(updated.body.authors).toHaveLength(1);
  });

  it('validates shelf locations, synchronizes inventory, and archives/restores copies', async () => {
    const section = await api()
      .post('/api/v1/sections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nameEn: `Section ${suffix}`,
        nameAr: `قسم ${suffix}`,
        code: `${suffix}-section`,
        floor: 'T',
      });
    const shelf = await api()
      .post('/api/v1/shelves')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sectionId: section.body.id,
        code: `${suffix}-shelf`,
        nameEn: 'Test shelf',
        nameAr: 'رف اختبار',
      });
    const category = (await api().get('/api/v1/categories')).body[0];
    const author = (await api().get('/api/v1/authors')).body[0];
    const book = await api()
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: `Copy Test ${suffix}`,
        slug: `${suffix}-copies`,
        isbn13: `978${String(Date.now()).slice(-10)}`,
        categoryId: category.id,
        authorIds: [author.id],
      });
    const invalid = await api()
      .post('/api/v1/book-copies')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ bookId: book.body.id, sectionId: section.body.id, shelfId: 'bad-id' });
    expect(invalid.status).toBe(400);
    const copy = await api()
      .post('/api/v1/book-copies')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        bookId: book.body.id,
        sectionId: section.body.id,
        shelfId: shelf.body.id,
        copyCode: `${suffix}-copy`,
        barcode: `${suffix}-barcode`,
      });
    expect(copy.status).toBe(201);
    expect(
      (
        await api()
          .patch(`/api/v1/book-copies/${copy.body.id}/status`)
          .set('Authorization', `Bearer ${librarianToken}`)
          .send({ status: 'BORROWED' })
      ).status,
    ).toBe(200);
    expect(
      (await prisma.book.findUniqueOrThrow({ where: { id: book.body.id } })).availableCopies,
    ).toBe(0);
    expect(
      (
        await api()
          .get(`/api/v1/book-copies/${copy.body.id}/qr`)
          .set('Authorization', `Bearer ${librarianToken}`)
      ).body.value,
    ).toBe(`copy:${suffix}-copy`);
    expect(
      (
        await api()
          .post(`/api/v1/book-copies/${copy.body.id}/archive`)
          .set('Authorization', `Bearer ${librarianToken}`)
      ).status,
    ).toBe(201);
    expect(
      (
        await api()
          .post(`/api/v1/book-copies/${copy.body.id}/restore`)
          .set('Authorization', `Bearer ${librarianToken}`)
      ).status,
    ).toBe(201);
    const inventory = await prisma.book.findUniqueOrThrow({ where: { id: book.body.id } });
    expect(inventory.totalCopies).toBe(1);
    expect(inventory.availableCopies).toBe(1);
  });

  it('keeps archived books private while librarian and administrator listings can restore them', async () => {
    const book = (await api().get('/api/v1/books?limit=1')).body.items[0];
    expect(
      (
        await api()
          .post(`/api/v1/books/${book.id}/archive`)
          .set('Authorization', `Bearer ${librarianToken}`)
      ).status,
    ).toBe(201);
    expect((await api().get('/api/v1/books?archiveState=archived')).status).toBe(403);
    expect(
      (
        await api()
          .get('/api/v1/books?archiveState=archived')
          .set('Authorization', `Bearer ${memberToken}`)
      ).status,
    ).toBe(403);
    const librarian = await api()
      .get('/api/v1/books?archiveState=archived&q=' + encodeURIComponent(book.title))
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(librarian.status).toBe(200);
    expect(
      librarian.body.items.some(
        (item: { id: string; isArchived: boolean }) => item.id === book.id && item.isArchived,
      ),
    ).toBe(true);
    expect(
      (
        await api()
          .get('/api/v1/books?includeArchived=true')
          .set('Authorization', `Bearer ${adminToken}`)
      ).status,
    ).toBe(200);
    expect(
      (await api().get(`/api/v1/books?q=${encodeURIComponent(book.title)}`)).body.items.some(
        (item: { id: string }) => item.id === book.id,
      ),
    ).toBe(false);
    expect(
      (
        await api()
          .post(`/api/v1/books/${book.id}/restore`)
          .set('Authorization', `Bearer ${adminToken}`)
      ).status,
    ).toBe(201);
  });

  it('lists archived copies for managers and restores inventory counters transactionally', async () => {
    expect((await api().get('/api/v1/book-copies')).status).toBe(401);
    const active = await api()
      .get('/api/v1/book-copies?status=AVAILABLE&limit=1')
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(active.status).toBe(200);
    const copy = active.body.items[0];
    const before = await prisma.book.findUniqueOrThrow({ where: { id: copy.book.id } });
    expect(
      (
        await api()
          .post(`/api/v1/book-copies/${copy.id}/archive`)
          .set('Authorization', `Bearer ${librarianToken}`)
      ).status,
    ).toBe(201);
    const archived = await api()
      .get(
        `/api/v1/book-copies?archiveState=archived&q=${encodeURIComponent(copy.copyCode)}&page=1&limit=1`,
      )
      .set('Authorization', `Bearer ${adminToken}`);
    expect(archived.status).toBe(200);
    expect(archived.body.items[0]).toMatchObject({
      id: copy.id,
      isArchived: true,
      location: expect.any(Object),
    });
    expect(
      (
        await api()
          .post(`/api/v1/book-copies/${copy.id}/restore`)
          .set('Authorization', `Bearer ${librarianToken}`)
      ).status,
    ).toBe(201);
    const after = await prisma.book.findUniqueOrThrow({ where: { id: copy.book.id } });
    expect(after.totalCopies).toBe(before.totalCopies);
    expect(after.availableCopies).toBe(before.availableCopies);
  });
});
