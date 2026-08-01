process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  'postgresql://smart_library:change-me-for-local-development@localhost:5432/smart_library_test?schema=public';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.COOKIE_NAME = 'smart_library_refresh';
