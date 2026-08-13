# NAWA Campus reservations

## Purpose and boundaries

A reservation is a member's temporary claim on one physical Campus `BookCopy` before pickup. It does not replace borrowing: `Loan` remains the source of truth only after a librarian completes physical pickup in a later phase.

Phase 5.2 is complete for the protected API lifecycle `CREATE`, `QUERY`, `CANCEL`, and `EXPIRE`. That backend phase itself introduced no Reserve button or member frontend, and still contains no pickup token, QR ticket, scanner, collection, Loan conversion, notification, payment, or checkout behavior.

## Phase 5.3.1 student Reserve UX

The first student-facing flow now reuses the completed Reservation API from a Campus Book Details page. An eligible physical Campus title presents its real availability, available-copy count, College Library location, floor, and room beside a clear `احجز للاستعارة` / `Reserve for pickup` action. Unavailable and non-member states are explicit, and the action cannot be submitted twice while pending.

Unauthenticated students are sent to the existing NAWA account flow with an encoded, validated internal `returnTo` path. Successful login updates the in-memory access session immediately and returns to the same Book Details URL, including safe query context; absolute, protocol-relative, backslash, and login-loop destinations are rejected. On application startup, an existing HTTP-only refresh cookie is exchanged through the established refresh and `/auth/me` endpoints so the frontend can restore the safe role/name session without browser token storage.

The request contains only `bookId`; identity comes from the bearer token and the backend remains authoritative for eligibility and physical-copy selection. Successful creation replaces the action with a persistent, localized confirmation using the returned book, ACTIVE state, copy code, Campus pickup floor/room, and exact server-controlled `expiresAt`. Duplicate, unavailable, ineligible, missing-book, expired-session, and unexpected/network responses receive safe localized handling without exposing backend internals.

Phase 5.3.1 does not add `/my-reservations`, cancellation UI, pickup confirmation, QR/scanning, `COLLECTED`, Reservation-to-Loan conversion, notifications, or staff reservation actions. Phase 5.3.2 is responsible for My Reservations.

## Create reservation API

`POST /api/v1/reservations` is restricted to an authenticated `MEMBER`. The body contains only an active Campus book UUID:

```json
{
  "bookId": "00000000-0000-4000-8000-000000000000"
}
```

The member identity always comes from the validated access token. Librarians and administrators cannot use this member-self-service endpoint, and a client cannot nominate another member or a physical copy.

The safe response contains the reservation timestamps/status, a display-safe book summary, the assigned copy's ID/code/status/condition, the Campus library/floor/room/section/shelf pickup location, and committed book availability. It excludes password/token fields, member private data, copy barcode/QR values, acquisition data, source-inventory metadata, and any pickup token.

Errors use the normal API contract:

- `401` for missing authentication or an account that is no longer active;
- `403` for a non-MEMBER role or an otherwise ineligible authenticated member;
- `404` when the active book does not exist;
- `409` for an existing ACTIVE member/book reservation, no eligible Campus copy, or an exhausted concurrent availability race.

## Member queries and cancellation

- `GET /api/v1/reservations/me` returns only the JWT member's newest-first reservations. It supports `status=active|cancelled|expired|collected|all`, positive integer `page`, and positive integer `limit` (maximum 50). Malformed values return `400`.
- `GET /api/v1/reservations/:id` returns a safe owned reservation; another member receives `403`.
- `POST /api/v1/reservations/:id/cancel` cancels only an owned, genuinely ACTIVE, unexpired reservation.

Responses include `canCancel`, safe book/copy data, Campus pickup location, and current counters. Cancellation locks the reservation and atomically applies `ACTIVE → CANCELLED`, `RESERVED → AVAILABLE`, counter synchronization, and one `RESERVATION_CANCELLED` audit entry. Repetition and terminal/inconsistent states return `409` without another release or audit.

## Automatic expiration

`ReservationExpirationScheduler` runs one expiration pass when the Nest application starts and then every 60 seconds. `RESERVATION_EXPIRATION_INTERVAL_MS` accepts only safe integer values from 5000 through 2147483647 milliseconds; unset, blank, zero, negative, fractional, non-numeric, too-small, and excessively large values fall back to 60000. One process never overlaps its own interval passes, startup/pass errors are logged without crashing startup, and the interval is cleared during Nest shutdown. Jest disables the timer and invokes the same service method directly; no BullMQ/Redis queue or new dependency was introduced.

Each due candidate is processed in its own serializable transaction. PostgreSQL row locking (with `SKIP LOCKED` for workers) ensures competing application instances cannot transition the same reservation twice. A successful expiration atomically applies `ACTIVE → EXPIRED`, `RESERVED → AVAILABLE`, counter synchronization, and exactly one `RESERVATION_EXPIRED` audit event. Future, CANCELLED, COLLECTED, and already EXPIRED records are untouched.

Member queries synchronously process their relevant stale reservations before reading. Reservation creation processes due ACTIVE reservations for the requested book before duplicate and availability checks. This defensive path reuses the same locked transition logic, so scheduler delay cannot leave an expired hold blocking a legitimate request.

When cancellation races expiration, the reservation row lock chooses one terminal transition. The loser observes the committed terminal state or skips the locked worker row; the copy is released and counters/audit updated exactly once. Real database tests also cover cancel/create and expiration/create races: after the releasing transaction wins, a competing member can obtain the same copy without duplicate ACTIVE rows, stale AVAILABLE state, incorrect counters, or duplicate lifecycle audits. A failed inconsistent expiration candidate is rolled back and logged without preventing unrelated due reservations from being processed.

## Data model

`Reservation` stores:

- UUID `id`;
- `memberId`, `bookId`, and `bookCopyId` relations using `onDelete: Restrict`;
- lifecycle `status`;
- `reservedAt` and required `expiresAt` timestamps;
- optional `cancelledAt` and `collectedAt` lifecycle timestamps;
- `createdAt` and `updatedAt` audit timestamps.

The supported reservation states are:

- `ACTIVE`: held for this member until pickup, cancellation, or expiration;
- `CANCELLED`: released before pickup;
- `EXPIRED`: pickup window ended without collection;
- `COLLECTED`: reserved for the future pickup flow; Phase 5.2 does not implement this transition or create a Loan.

`ReservationStatus` describes the claim record. `BookCopyStatus.RESERVED` describes the current physical-copy state. They remain separate so historical reservations do not overwrite current inventory state.

## Integrity and concurrency

The `reservation_foundation` migration adds partial unique indexes that apply only to `ACTIVE` records:

- one active reservation per `bookCopyId`;
- one active reservation per `(memberId, bookId)`.

This allows cancelled, expired, and collected history to remain queryable. Normal indexes support member history, book demand, copy lookup, status filtering, and expiration scans.

Phase 5.2.2 enforces reservation creation in one serializable transaction:

1. lock and revalidate the authenticated member;
2. validate the active requested book and reject an existing ACTIVE member/book reservation;
3. choose the first eligible copy by stable `copyCode`, using PostgreSQL `FOR UPDATE OF copy SKIP LOCKED`;
4. require an active, non-archived Campus room/floor/library and active section/shelf, `AVAILABLE` copy status, and non-damaged condition;
5. use one `reservedAt` timestamp and the setting-backed policy to calculate `expiresAt`;
6. create the ACTIVE reservation and change the copy from `AVAILABLE` to `RESERVED`;
7. recalculate the parent book's `totalCopies` and `availableCopies` through the catalog's established inventory synchronizer;
8. write one `RESERVATION_CREATED` audit record with IDs, timestamps, and copy-state transition;
9. commit all changes together.

Only genuine serializable/write-conflict and database deadlock signals (`P2034`, SQLSTATE `40001`, and raw-query SQLSTATE `40P01`) receive a bounded three-attempt retry. Validation, authentication, authorization, missing-resource, normal lifecycle, and ordinary uniqueness conflicts are never blindly retried. Exhaustion and active-reservation uniqueness conflicts are translated to safe `409` responses without Prisma, SQL, or index details. PostgreSQL partial unique indexes remain the final defense against duplicate active copy and member/book reservations, and the real concurrency test sends two requests from different eligible members for one available copy and verifies exactly one succeeds.

Catalog management cannot manufacture `RESERVED`, mutate/archive an actively reserved copy, or archive a book with an ACTIVE reservation. Reservation create/cancel/expire owns the copy transition, and the established catalog synchronizer recalculates counters inside the same transaction. Audit records participate in those transactions: `RESERVATION_CREATED` and `RESERVATION_CANCELLED` use the member actor, while `RESERVATION_EXPIRED` uses a null/system actor.

Later pickup work must convert collection into `COLLECTED`, `BORROWED`, and a new Loan in one transaction.

## Expiration policy

`ReservationPolicyService` reads the numeric `SystemSetting` key `reservation.pickupWindowHours`. Seeded development and test environments use 24 hours. Invalid or absent configuration falls back to the same 24-hour default in one policy location, so later administrator settings do not require rewriting reservation workflow logic.

Creation uses the policy inside the reservation transaction and one consistent operation timestamp. Expiration uses the lightweight in-process scheduler described above rather than cron or BullMQ.

The deterministic development seed no longer assigns `RESERVED` as a decorative copy status. A reserved copy must now be created together with a real Reservation by the transactional workflow planned for Phase 5.2.2.
