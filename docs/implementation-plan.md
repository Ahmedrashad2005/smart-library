# Smart Library implementation plan

The full project specification is authoritative. This plan preserves its required order and makes phase completion auditable.

## Phase 1 — Foundation

- [x] Inspect and preserve the initial repository state.
- [x] Establish npm-workspace monorepo structure.
- [x] Configure a minimal NestJS backend development server with a health endpoint.
- [x] Configure a minimal React/Vite/Tailwind frontend development shell.
- [x] Configure a minimal FastAPI recommendation-service health endpoint and Python dependencies.
- [x] Add Dockerfiles, Compose services, PostgreSQL, Redis, Mailpit, health checks, and startup dependencies.
- [x] Add `.env.example`, ignores, formatting/lint/type-check configuration, and initial setup documentation.
- [x] Add permanent project guidance in `AGENTS.md`.
- [x] Run Phase 1 configuration checks.

Phase 1 deliberately contains no domain schema, authentication, catalog, UI flow, or business feature implementation.

## Phase 2 — Database and authentication

- [x] Model Phase 2 Prisma entities with UUIDs, timestamps, constraints, indexes, and archive fields.
- [ ] Create and verify migrations and realistic fake seed data (admin, librarians, members, catalog, copies, circulation, fines, reviews, notifications, history).
- [ ] Implement registration, verification, login/logout, rotated hashed refresh cookies, reset/change password, profile, token revocation, rate limits, and account state enforcement.
- [ ] Implement user management, role guards, audit foundations, validation, error/response conventions, and tests.

## Phase 3 — Library catalog — Complete

- [x] Implement categories, authors, publishers, sections, shelves, books, book copies, archive/restore, QR payloads, and exact locations.
- [x] Implement catalog APIs, inventory synchronization, audit records, RBAC, filtering, pagination, and responsive bilingual catalog pages.
- [x] Implement verified role-protected management routes for books, copies, categories, authors, publishers, sections, and shelves, including real API-backed lists, forms, edit, archive/restore, feedback, and responsive RTL/LTR behavior.
- [x] Expand deterministic bilingual catalog seed data (10 categories, 20 authors, 5 publishers, 5 sections, 15 shelves, 50 books, and multiple copies).
- [x] Add database-backed catalog integration coverage and catalog frontend logic tests.
- [x] Add role-protected archived-book and complete book-copy administrative listings, archive-state filters, reload-safe restore workflows, and corresponding backend/frontend tests.
- [x] Defer indexed full-text/trigram search, suggested corrections, and search history by the approved Phase 3 scope; these are not implemented and are not a Phase 3 acceptance blocker.

## Phase 4 — Library operations — Complete

- [x] Part 1: Implement configurable rules and transaction-safe borrowing, returns, renewal, due dates, eligibility, availability counters, audit logging, and loan query APIs.
- [x] Part 2: Implement role-protected staff/member loan pages, manual/QR/barcode-assisted borrowing and returns, and renewal workflows.
- [x] Part 3: Verify the live Docker stack, both database migration targets, seed/inventory consistency, all automated checks, live circulation/RBAC/privacy/concurrency workflows, and live staff/member frontend routes.
- [x] Verify renewal eligibility and clear overdue/limit/ownership rejections.
- [x] Verify camera scanning is user-initiated, resource-safe, accessible, and retains manual-entry fallback.
- [x] Close Phase 4 with 4 backend suites / 25 tests and 14 frontend files / 78 tests (103 total).

Reservations/waiting lists, fines, payments/waivers, notifications, recommendations, reviews, reports, and dashboards are outside the approved Phase 4 scope and remain unimplemented. The centralized loan policy has no administrator settings UI yet.

## Phase 5 — User engagement

- [ ] Implement verified borrower ratings/reviews.
- [ ] Implement in-app/email notifications, preferences, BullMQ jobs, and schedules.
- [ ] Implement book acquisition requests and damaged/missing/information/location reports.
- [ ] Implement FastAPI TF-IDF/cosine recommendations using catalog and user activity; backend integration and fallback popular results.

## Phase 6 — Dashboards

- [ ] Implement member dashboard and account pages.
- [ ] Implement librarian operational dashboard and workflows.
- [ ] Implement admin management, analytics, reports, settings, and audit-log pages with responsive charts.

## Phase 7 — Quality and deployment

- [ ] Complete meaningful backend unit/integration tests and frontend flow/component tests.
- [ ] Complete Swagger/OpenAPI and all required architecture, database, API, user-flow, deployment, and testing documentation (including Mermaid diagrams).
- [ ] Verify Docker build, migration/seed startup, health checks, and production-appropriate Nginx configuration.
- [ ] Add GitHub Actions for lint, type checks, tests, builds, and Python validation.
- [ ] Run final accessibility, Arabic RTL/LTR, performance, security, concurrency, and end-to-end verification; remove unused code.
