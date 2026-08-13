const fs = require('node:fs');

require('dotenv').config({ path: '/home/ahmed/smart library/.env' });
process.env.DATABASE_URL = process.env.DATABASE_URL.replace('@postgres:', '@127.0.0.1:');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const api = 'http://localhost:3000/api/v1';
const fixturePath = '/home/ahmed/smart library/.nawa-visual-532b/fixtures.json';

async function request(path, options = {}, token) {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'nawa-visual-532b',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(payload)}`);
  return payload.data ?? payload;
}

async function main() {
  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'member5@smart-library.test', password: 'SmartLib123' }),
  });
  const books = await request('/books?campus=true&page=1&limit=50');
  const availableBooks = books.items.filter(
    (book) =>
      book.campusAvailability?.availabilityStatus === 'AVAILABLE' &&
      book.campusAvailability.availableCopies > 0,
  );
  if (availableBooks.length < 4)
    throw new Error(`Only ${availableBooks.length} separate Campus books are available`);

  const fixtures = { accessToken: login.accessToken, reservations: [] };
  for (const book of availableBooks.slice(0, 4)) {
    const created = await request(
      '/reservations',
      { method: 'POST', body: JSON.stringify({ bookId: book.id }) },
      login.accessToken,
    );
    fixtures.reservations.push({ id: created.id, bookSlug: created.book.slug });
    fs.writeFileSync(fixturePath, JSON.stringify(fixtures, null, 2));
  }

  const [cancelled, expired, normal, warning] = fixtures.reservations;
  await request(`/reservations/${cancelled.id}/cancel`, { method: 'POST' }, login.accessToken);
  await prisma.reservation.update({
    where: { id: expired.id },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  await prisma.reservation.update({
    where: { id: warning.id },
    data: { expiresAt: new Date(Date.now() + 45 * 60_000) },
  });
  await request('/reservations/me?status=expired&page=1&limit=12', {}, login.accessToken);
  fs.writeFileSync(
    fixturePath,
    JSON.stringify({ ...fixtures, roles: { cancelled, expired, normal, warning } }, null, 2),
  );
  console.log('Created isolated member5 visual fixtures: 2 ACTIVE, 1 CANCELLED, 1 EXPIRED');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
