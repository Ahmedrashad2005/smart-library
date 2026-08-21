import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

const confirmedFacultyNames = [
  'كلية الطب البشري',
  'كلية طب الفم والأسنان',
  'كلية الطب البيطري',
  'كلية العلاج الطبيعي',
  'كلية الصيدلة',
  'كلية تكنولوجيا العلوم الصحية',
  'كلية التمريض',
  'كلية هندسة الطاقة والبترول',
  'كلية الهندسة',
  'كلية الذكاء الاصطناعي',
  'كلية الحقوق',
  'كلية الإدارة',
  'كلية الآداب',
];

describe('Delta University faculties foundation', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const fixtureRelations: Array<{ bookId: string; facultyId: string }> = [];
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    for (const relation of fixtureRelations.splice(0))
      await prisma.bookFaculty.deleteMany({ where: relation });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('returns exactly the 13 confirmed Arabic faculties without invented English labels', async () => {
    const response = await api().get('/api/v1/faculties');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(13);
    expect(response.body.map((faculty: { nameAr: string }) => faculty.nameAr)).toEqual(
      confirmedFacultyNames,
    );
    expect(
      response.body.every((faculty: { nameEn: string | null }) => faculty.nameEn === null),
    ).toBe(true);
    expect(response.body[0]).not.toHaveProperty('createdAt');
    expect(response.body[0]).not.toHaveProperty('updatedAt');
    expect(response.body[0]).not.toHaveProperty('isActive');
  });

  it('returns a safe faculty detail and a truthful zero count when nothing is assigned', async () => {
    const faculty = await prisma.faculty.findUniqueOrThrow({ where: { slug: 'law' } });
    await prisma.bookFaculty.deleteMany({ where: { facultyId: faculty.id } });
    const response = await api().get('/api/v1/faculties/law');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ slug: 'law', nameAr: 'كلية الحقوق', bookCount: 0 });
    expect(response.body).not.toHaveProperty('books');
  });

  it('filters books through an isolated exact faculty relation fixture', async () => {
    const [faculty, book] = await Promise.all([
      prisma.faculty.findUniqueOrThrow({ where: { slug: 'artificial-intelligence' } }),
      prisma.book.findFirstOrThrow({ where: { isArchived: false, deletedAt: null } }),
    ]);
    const relation = { bookId: book.id, facultyId: faculty.id };
    const existing = await prisma.bookFaculty.findUnique({
      where: { bookId_facultyId: relation },
    });
    if (!existing) {
      await prisma.bookFaculty.create({ data: relation });
      fixtureRelations.push(relation);
    }

    const response = await api().get(
      '/api/v1/books?facultySlug=artificial-intelligence&page=1&limit=12',
    );
    expect(response.status).toBe(200);
    expect(response.body.items.map((item: { id: string }) => item.id)).toContain(book.id);
    expect(
      response.body.items.every((item: { faculties: Array<{ facultyId: string }> }) =>
        item.faculties.some(({ facultyId }) => facultyId === faculty.id),
      ),
    ).toBe(true);
  });

  it('returns 404 for an unconfirmed or unknown faculty slug', async () => {
    expect((await api().get('/api/v1/faculties/invented-fourteenth-faculty')).status).toBe(404);
  });
});
