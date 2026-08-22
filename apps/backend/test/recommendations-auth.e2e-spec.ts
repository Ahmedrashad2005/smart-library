import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { RecommendationClient } from '../src/modules/recommendations/recommendation.client';

describe('recommendation endpoint identity and RBAC', () => {
  let app: INestApplication;
  let memberToken = '';
  let librarianToken = '';
  const api = () => request(app.getHttpServer());
  const login = async (email: string) =>
    (await api().post('/api/v1/auth/login').send({ email, password: 'SmartLib123' })).body
      .accessToken as string;

  beforeAll(async () => {
    process.env.RECOMMENDATION_ENABLED = 'false';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RecommendationClient)
      .useValue({ rank: jest.fn() })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    memberToken = await login('member1@smart-library.test');
    librarianToken = await login('librarian1@smart-library.test');
  });

  afterAll(async () => app.close());

  it('rejects an unauthenticated recommendation request', async () => {
    expect((await api().get('/api/v1/recommendations/me')).status).toBe(401);
  });

  it('rejects a non-member role', async () => {
    expect(
      (
        await api()
          .get('/api/v1/recommendations/me')
          .set('Authorization', `Bearer ${librarianToken}`)
      ).status,
    ).toBe(403);
  });

  it('uses JWT member identity and ignores attempts to choose another member', async () => {
    const normal = await api()
      .get('/api/v1/recommendations/me?limit=2')
      .set('Authorization', `Bearer ${memberToken}`);
    const attemptedOverride = await api()
      .get('/api/v1/recommendations/me?limit=2&memberId=another-member')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(normal.status).toBe(200);
    expect(attemptedOverride.status).toBe(200);
    expect(attemptedOverride.body.items).toEqual(normal.body.items);
    expect(normal.body.items.length).toBeLessThanOrEqual(2);
  });

  it('rejects an unsupported interface locale', async () => {
    expect(
      (
        await api()
          .get('/api/v1/recommendations/me?locale=fr')
          .set('Authorization', `Bearer ${memberToken}`)
      ).status,
    ).toBe(400);
  });
});
