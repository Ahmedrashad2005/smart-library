# NAWA Unified Knowledge Platform implementation plan

The full project specification is authoritative. This plan preserves its required order and makes phase completion auditable.

## Delta University Library branding and faculties foundation — Complete

- [x] Make Delta University Library the primary public/student identity and reduce NAWA to a subtle platform credit.
- [x] Preserve the approved organized Arabic bookstore-style design rhythm without copying retailer branding, assets, colors, or exact layouts.
- [x] Keep the existing search, catalog, Campus, book detail, authentication, My Loans, and My Reservations flows connected.
- [x] Add a responsive official-logo drop-in treatment without fabricating a university logo.
- [x] Remove delivery/payment/Store-first emphasis from the student header, hero, and service strip without destructive backend removal.
- [x] Add the prominent Arabic-first faculties section and `/faculties` plus `/faculties/:slug` routes.
- [x] Add the minimal `Faculty` and `BookFaculty` data foundation and public safe APIs.
- [x] Install only the 13 confirmed Arabic faculty names; leave official English labels and faculty #14 unpopulated until confirmed.
- [x] Preserve real books, loans, reservations, copy states, counters, and existing student behavior.
- [x] Add focused frontend and database-backed API coverage and document the new response/filter contract.

This direction phase adds no AI/Gemini assistant, departments, QR/scanning, large librarian dashboard, or fake faculty/book associations. Store-capable internals remain for a future explicit decision but are no longer the dominant student experience.

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

## Phase 5 — NAWA Campus and engagement — In progress

### Phase 5.0 — Safety and product alignment

- [x] Preserve the approved NAWA marketplace homepage, header, visual language, and existing Phase 1–4 technical work.
- [x] Document NAWA Store, NAWA Campus, NAWA Read, and the Buy — Borrow — Read direction without risky internal package/directory renames.
- [x] Work on the isolated `phase-5-campus` branch and record the pre-change verification baseline.

### Phase 5.1 — Real university-library inventory

- [x] Add normalized `Library`, `LibraryFloor`, and `LibraryRoom` entities and integrate them with existing sections, shelves, and copies.
- [x] Preserve home location independently from current copy status and keep opaque source shelf codes exact.
- [x] Import all 23 authoritative source rows into Floor 3, Room 315 of `مكتبة الكلية`, one physical Campus copy per source row, without replacing the Store catalog.
- [x] Preserve raw publication information, genuine nulls, and DDC 621 without outside enrichment.
- [x] Extend safe catalog and location APIs, ADMIN structural management, RBAC, validation, and audit logging.
- [x] Add the bilingual responsive Campus availability card and accessible location dialog to Book Details without altering the approved homepage/header.
- [x] Add database-backed Campus/RBAC/privacy/status tests and rendered frontend Book Details tests.
- [x] Complete final full-suite, Docker/runtime, data, and manual responsive verification before closing Phase 5.1.

### Phase 5.1.5 — NAWA Campus UI integration and marketplace polish

- [x] Preserve the approved two-level Store-first marketplace header, homepage structure, hero illustration, and NAWA visual language.
- [x] Broaden the hero copy to represent books, learning tools, technology, and knowledge while retaining functional catalog search.
- [x] Replace public internal Campus inventory terminology and make long category labels readable without breaking the horizontal scroller.
- [x] Add clear `مكتبة الكلية` / `Campus Library` navigation through existing header patterns without overcrowding the utility row.
- [x] Add `/campus` using the real library hierarchy, 23 Campus holdings, real source groups, search, availability, pagination, and safe loading/error/empty states.
- [x] Add a real available-Campus homepage shelf and accurate subtle Campus badges to shared marketplace cards.
- [x] Preserve the Phase 5.1 Book Details availability/location card and the existing Phase 4 circulation lifecycle.
- [x] Add database-backed Campus catalog contract coverage and rendered frontend Campus/page/card/navigation coverage.
- [x] Complete final formatting, full lint/type/test/build, Docker/runtime, API, and 1440/900/390 visual verification.

Phase 5.1.5 is an integration checkpoint before reservations. It creates no reservation, waitlist, pickup-ticket/QR, NAWA Read, offline-reading, or commerce behavior.

### Phase 5.1.6 — NAWA Marketplace Visual Recomposition

- [x] Preserve NAWA branding, real APIs/data, the approved hero illustration, Store-first navigation, Campus hierarchy, and Phase 4 circulation behavior.
- [x] Refine the two-row header, hero, category rail, product shelves, portrait book cards, `/campus`, and Book Details into a denser mature retail structure.
- [x] Reuse one resilient NAWA cover component for shelf, catalog, Campus, and Book Details missing/broken-cover states.
- [x] Keep Campus integrated with real Floor 3 / Room 315 availability and no reservation, pickup, commerce, or Phase 5.2 behavior.
- [x] Complete focused component checks, full formatting/lint/type/test/build verification, and manual 1440/900/390 Arabic RTL and English LTR visual inspection.

Phase 5.1.6 is the final structural marketplace design pass before reservations. The public UI was intentionally recomposed around mature bookstore hierarchy and retail density while preserving NAWA identity, existing behavior, and authoritative data. Jarir informed only structural UX qualities; no proprietary brand or visual assets were copied.

### Phase 5.1.7 — Final Visual Polish and Acceptance

- [x] Keep the two-level marketplace header while reducing its footprint, preserving the dominant real catalog search, and removing the non-functional Brands control from visible navigation.
- [x] Remove the duplicate Hero search and replace it with functional Browse Books and Campus Library actions.
- [x] Preserve six complete product cards at 1440px while improving portrait-cover prominence, metadata direction, two-line title clamping, one-line author treatment, 40px actions, and deterministic NAWA fallback-cover variation.
- [x] Compact the Campus introduction and show the real Floor 3 / Room 315 location beside a stable unfiltered holdings total supplied by the catalog API.
- [x] Add focused rendered coverage for Hero actions, hidden Brands navigation, fallback-cover variation, mixed-language direction, Campus location, and stable API-backed Campus totals.
- [x] Complete full formatting, lint, type-check, test, build, diff, Docker/runtime, and manual 1440/900/390 RTL/LTR acceptance checks.

Phase 5.1.7 is a frontend visual-acceptance pass only. It does not add reservations, payments, checkout, Brands filtering, new backend contracts, or any Phase 5.2 behavior. Jarir remains a structural-density reference only; NAWA copy, assets, brand, and product behavior remain original.

### Phase 5.2 — Reservation Engine — Complete

#### Phase 5.2.1 — Reservation Foundation and Data Model

- [x] Add the historical `Reservation` entity with member, book, and physical-copy relations and `ACTIVE`, `CANCELLED`, `EXPIRED`, and `COLLECTED` lifecycle states.
- [x] Preserve the existing physical-copy `RESERVED` state and keep Reservation lifecycle state separate from copy state.
- [x] Add PostgreSQL partial unique indexes for one active reservation per copy and one active reservation per member/book while retaining completed history.
- [x] Add a SystemSetting-backed 24-hour pickup-window policy with a safe code fallback.
- [x] Wire an internal Reservations module without exposing incomplete endpoints or frontend controls.
- [x] Apply `reservation_foundation` to development and isolated test databases and add database-backed foundation coverage.
- [x] Complete full format, lint, type-check, backend/frontend tests, build, migration, diff, data, and Docker health verification.

Phase 5.2.1 adds data and policy foundations only. Reservation creation/cancellation/expiration transactions, inventory-counter updates, member eligibility, copy locking, pickup/collection, Loan creation, audit events, jobs, notifications, QR tickets/scanning, and all member/staff reservation UI remain deferred to Phase 5.2.2 and later.

#### Phase 5.2.2 — Create Reservation and Concurrency Safety

- [x] Add MEMBER-only `POST /api/v1/reservations`; derive membership identity from the authenticated account and accept only a book ID.
- [x] Validate the active verified member, active book, and eligible active Campus inventory without exposing copy choice to the member.
- [x] Select deterministically by copy code and lock with PostgreSQL `FOR UPDATE OF copy SKIP LOCKED` inside the established serializable transaction/retry pattern.
- [x] Atomically create the ACTIVE reservation, change `AVAILABLE → RESERVED`, synchronize book counters, calculate policy expiration, and write a safe audit event.
- [x] Translate duplicate, unavailable, and exhausted concurrency races to stable HTTP errors without leaking Prisma/PostgreSQL details.
- [x] Add database-backed endpoint, eligibility, history, direct-borrow regression, and real competing-request coverage.
- [x] Complete full Prisma, format, lint, type-check, backend/frontend tests, build, diff, database-data, and Docker/runtime verification.

Phase 5.2.2 creates reservations only. Cancellation, automatic expiration/release, collection, reservation-to-Loan conversion, pickup tickets/QR/scanning, member reservation queries/UI, jobs, and notifications remain deferred.

#### Phase 5.2.3 — Reservation Queries, Cancellation, and Expiration

- [x] Add MEMBER-only paginated/status-filtered `GET /reservations/me` and ownership-protected `GET /reservations/:id` with safe book, copy, location, and cancellation data.
- [x] Add transactional owner-only cancellation with reservation locking, `ACTIVE → CANCELLED`, `RESERVED → AVAILABLE`, counter synchronization, and one audit event.
- [x] Add reusable idempotent due-expiration processing with row locking, `ACTIVE → EXPIRED`, copy release, counter synchronization, and one audit event.
- [x] Run expiration automatically at service startup and at a lightweight configurable interval without adding a queue dependency.
- [x] Defensively process relevant stale ACTIVE reservations before queries and new reservation conflict/availability decisions.
- [x] Cover ownership, pagination/filtering, cancellation, terminal/inconsistent states, expiration, re-reservation, and real cancellation/processor races with PostgreSQL-backed tests.
- [x] Complete full Prisma, format, lint, type-check, backend/frontend tests, build, diff, database-data, and Docker/runtime verification.

Phase 5.2.3 completes CREATE, QUERY, CANCEL, and EXPIRE only. Collection, pickup, reservation-to-Loan conversion, QR/tokens/scanning, member reservation frontend, jobs/notifications, and other later features remain deferred.

#### Phase 5.2.4 — Reservation Engine Final Hardening and Acceptance

- [x] Validate status/pagination input, cap page size at 50, preserve ownership before defensive expiration, and document the safe API error contract.
- [x] Bound scheduler configuration, prevent overlapping local passes, preserve startup error isolation, and verify Nest shutdown timer cleanup.
- [x] Keep `RESERVED` under Reservation Engine control by rejecting manual assignment, active-copy mutation/archive, and active-reservation book archive.
- [x] Verify create/cancel/expire atomicity, in-transaction audit semantics, bounded serialization/deadlock retries, exact partial-index predicates, and counter invariants.
- [x] Cover malformed queries, foreign stale details, catalog bypasses, failed-row isolation, cancel/create, expiration/create, cancel/expiration, competing workers, and direct-Borrow rejection with real PostgreSQL-backed tests.
- [x] Complete full Prisma, seed, format, lint, type-check, backend/frontend tests, build, diff, database-integrity, Campus-data, and Docker/runtime verification.

Phase 5.2 is complete for the backend Reservation Engine lifecycle `CREATE`, `QUERY`, `CANCEL`, and `EXPIRE`. `COLLECTED` remains a future state only; no pickup, reservation-to-Loan conversion, QR/scanner, member reservation frontend, or notifications were started.

### Phase 5.3 — Student Reservation UX — In progress

#### Phase 5.3.1 — Reserve UX and Frontend Auth Integration — Complete

- [x] Add a bilingual, accessible Reserve action to eligible Campus Book Details using the existing `POST /reservations` API and only `bookId`.
- [x] Present real physical availability, available-copy count, College Library floor/room, disabled unavailable state, and MEMBER-only guidance.
- [x] Replace developer/admin login language with a polished NAWA member account form and restore an existing HTTP-only refresh session without browser token storage.
- [x] Preserve a validated internal Book Details return path through login and reject open-redirect and login-loop inputs.
- [x] Prevent duplicate pending submissions and map duplicate, no-copy, 401, 403, 404, and network/unexpected outcomes to safe localized feedback.
- [x] Render a persistent localized success state from backend status, assigned copy, pickup location, and exact server-provided expiration.
- [x] Verify Arabic RTL and English LTR behavior, responsive 1440/900/390 layouts, accessibility, frontend/backend regressions, Docker health, and Campus data integrity.

Phase 5.3.1 exposes reservation creation only. Cancellation UI, pickup, QR/scanning, `COLLECTED`, Reservation-to-Loan conversion, notifications, and staff reservation actions remain unstarted.

#### Phase 5.3.2A — My Reservations: List, Filters & Details — Complete

- [x] Add the MEMBER-only `/my-reservations` and owned `/my-reservations/:id` routes with refresh-session waiting, safe login return, and non-member guidance.
- [x] Add natural My Reservations access to authenticated member account/mobile navigation while preserving My Loans.
- [x] Integrate server-side `active|cancelled|expired|collected|all` filters, URL page/filter state, a safe limit of 12, invalid-page correction, and accessible previous/next controls.
- [x] Render responsive bilingual book-activity cards and details with real cover/fallback, authors, localized status, lifecycle dates, safe copy code, and Campus pickup location.
- [x] Add localized loading, filter-aware empty, retryable error, stale-auth recovery, safe `403`/`404`, book-slug navigation, and no internal-ID presentation.
- [x] Extend the shared safe reservation response with cover and author display data and verify it through the existing database-backed lifecycle suite.
- [x] Verify meaningful route/API/page tests, Arabic RTL and English LTR, responsive 1440/900/390 layouts, full regressions, Docker health, and Campus data integrity.

Phase 5.3.2A remains the read-only foundation. Phase 5.3.2B adds Cancellation, Deadline UX, and final acceptance without changing the completed list/details contract. Pickup, QR/scanning, `COLLECTED`, Reservation-to-Loan conversion, notifications, and staff reservation actions remain outside that scope.

#### Phase 5.3.2B — Cancellation, Deadline UX & Final Acceptance — Complete

- [x] Show cancellation only from backend `canCancel`, with a bilingual semantic confirmation, Escape/focus management, disabled pending controls, and duplicate-submit protection.
- [x] Use the existing owned cancellation endpoint, committed response, Active-list removal, server refetch, Cancelled-history visibility, and consistent detail/list state.
- [x] Map safe `403`, `404`, and network errors; on `409`, fetch the authoritative detail and present the winning terminal lifecycle state.
- [x] Present remaining time only from `expiresAt`, with minute-level updates and calm normal/soon/critical treatments rather than an invented reservation window.
- [x] Stop positive time at deadline and issue one lightweight authoritative list/detail refresh without local expiration or high-frequency API polling.
- [x] Verify cancellation, deadline, race, error, accessibility, RTL/LTR, responsive 1440/900/390, regression, Docker, and Campus/inventory integrity requirements.

**Phase 5.3.2 — My Reservations is complete:** members can view, filter, inspect, understand the deadline, and cancel their own eligible reservation while the backend remains lifecycle authority.

#### Phase 5.3.3 — Member Area Visual Polish & My Loans Redesign — Complete

- [x] Replace the member-facing generic circulation table with bilingual, responsive, book-oriented loan activity cards and safe owned-loan details.
- [x] Add shared My Loans/My Reservations local navigation while preserving their existing MEMBER-only routes and backend ownership boundaries.
- [x] Add real server-side member search by localized title, author, and copy code with status filters, URL pagination, safe loading/empty/error recovery, cover fallback, and no staff-only metadata.
- [x] Expose renewal eligibility and limits from the existing backend loan policy without changing its rules; confirm renewals in an accessible dialog and refresh authoritative state after lifecycle conflicts.
- [x] Verify keyboard behavior, duplicate-submit protection, Arabic RTL/English LTR, 1440/900/390 responsive layouts, privacy, full regressions, Docker health, and the unchanged real MEMBER Loan/Reservation fingerprint.

Phase 5.3.3 is a member presentation and safe-response refinement only. It adds no pickup, QR/scanning, `COLLECTED`, Reservation-to-Loan conversion, fines, payments, notifications, or new circulation policy.

### Later Phase 5 work — Not started

- [ ] Phase 5.3.4: continue only from separately approved Member Area scope; do not infer pickup, notification, fine/payment, or broader dashboard authorization.
- [ ] Later pickup phase: implement the separately approved pickup/collection scope; if authorized, it must atomically coordinate `COLLECTED`, copy/Loan state, counters, pickup proof, and replay safety.
- [ ] Implement verified borrower ratings/reviews.
- [ ] Implement in-app/email notifications, preferences, BullMQ jobs, and schedules.
- [ ] Implement book acquisition requests and damaged/missing/information/location reports.
- [ ] Implement FastAPI TF-IDF/cosine recommendations using catalog and user activity; backend integration and fallback popular results.

Phase 5 as a whole is **not complete**. Phase 5.1 does not implement reservation/waitlist flows, pickup verification, Store checkout/payments, or NAWA Read.

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
