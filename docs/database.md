# Phase 2 database

PostgreSQL is accessed exclusively through Prisma. The initial schema defines users, secure refresh sessions, email-verification and password-reset tokens, audit logs, and future system settings. Tokens are SHA-256 hashes; password hashes are Argon2.

```mermaid
erDiagram
  User ||--o{ RefreshToken : owns
  User ||--o{ EmailVerificationToken : verifies
  User ||--o{ PasswordResetToken : resets
  User ||--o{ AuditLog : acts
```

Run `npm run prisma:migrate:dev --workspace=@smart-library/backend`, then `npm run prisma:seed --workspace=@smart-library/backend`.
