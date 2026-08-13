# NAWA Unified Knowledge Platform API

## Phase 5.1 Campus locations and availability

`GET /api/v1/libraries` returns safe summaries of active Campus libraries. `GET /api/v1/libraries/:id` returns the active library → floor → room hierarchy. These reads are public so Book Details can explain where a physical Campus copy lives. They omit timestamps, audit data, copy identifiers, and other administrative fields.

Library structure changes are ADMIN-only:

- `POST /api/v1/libraries` and `PATCH /api/v1/libraries/:id`
- `POST /api/v1/libraries/:libraryId/floors` and `PATCH /api/v1/library-floors/:id`
- `POST /api/v1/library-floors/:floorId/rooms` and `PATCH /api/v1/library-rooms/:id`

Each write validates its active parent, reports uniqueness conflicts safely, and writes an audit record. Librarians retain book/copy management but cannot alter the structural library hierarchy.

Public `GET /api/v1/books/:slug` now includes `campusAvailability`. It contains aggregate `totalCopies`, `availableCopies`, `availabilityStatus`, and safe physical-copy presentation data: status, condition, library, floor, room, exact `shelfLocationCode`, and optional source collection. It intentionally omits internal source references, copy/barcode/QR codes, notes, acquisition metadata, and authentication/audit data. A Store-only title returns `NOT_HELD` with an empty Campus copy list.

`GET /api/v1/books/:id/availability` uses the same safe Campus mapping so detail and availability clients do not drift. Copy management accepts `homeLibraryRoomId`, exact `shelfLocationCode`, `sourceInventoryReference`, and `sourceCollection`; it validates that a selected shelf/section and home room are consistent. Status changes never erase the home location.

### Phase 5.1.5 Campus discovery query

The established public catalog endpoint also powers the marketplace-style Campus page; no duplicate catalog API was introduced:

```http
GET /api/v1/books?campus=true&q=java&available=true&sourceCollection=AI%20%2F%20General%20Programming%20%2F%20ML-DL%20%2F%20Processing&page=1&limit=8
```

- `campus=true` returns only active books with at least one active copy assigned to an active Campus room.
- `available=true` applies to the Campus copies when `campus=true`, rather than to unrelated Store/library copies.
- `q`, `page`, and `limit` retain the normal catalog search and pagination contract.
- `sourceCollection` is an exact optional filter over the three supplied source groups. The response provides a safe `sourceCollections` list for public filter controls.
- Every list item includes only the aggregate `campusAvailability` presentation fields: `hasPhysicalCopies`, `totalCopies`, `availableCopies`, and `availabilityStatus`. Raw Campus copies, source inventory references, barcodes, QR values, and management metadata are omitted.

Ordinary `GET /api/v1/books` behavior is unchanged. It now carries the same safe aggregate Campus availability on each returned book so marketplace cards can show an accurate, subtle Campus badge without a second request.

## Phase 4 Part 1 loans

`POST /api/v1/loans/borrow` and `POST /api/v1/loans/:id/return` require LIBRARIAN or ADMIN. Borrow accepts a member UUID plus one stable copy identifier (copy UUID, copy code, barcode, or QR payload); return requires a `BookCopyCondition` and optional note. `POST /api/v1/loans/:id/renew` permits the owning MEMBER or staff. `GET /api/v1/loans/me` is member-only; staff use `GET /api/v1/loans`, with `q`, status, date-range, member, book, copy, and pagination filters. Loan statuses are computed as active, returned, or overdue from return and due dates. The standard validation response applies to invalid UUIDs, dates, statuses, and conditions; business-rule failures return clear 400/403/409 responses.

Loan list and detail responses include safe book presentation data: nullable `coverImageUrl` and `authors` containing only `id`, `name`, and nullable `arabicName`. Member responses omit issuer/returner fields; staff responses include only their IDs and display names. Authentication fields, tokens, and audit metadata are never included. Borrow and return responses contain the committed final `bookCopy.status`.

Unavailable-copy races and repeated returns return `409 Conflict`. Ineligible accounts, policy-limit/overdue rejections, and archived resources return clear `400` responses; role and ownership violations return `401` or `403` as appropriate.

Swagger is available at `/api/docs`. Phase 2 provides authentication under `/api/v1/auth` and protected user administration under `/api/v1/users`. Access tokens use Bearer authentication; refresh tokens use the HTTP-only cookie `COOKIE_NAME`.

For the staff circulation UI, `GET /api/v1/users/members?q=` is available to LIBRARIAN and ADMIN. It returns a minimal member eligibility summary (verification/status, active and overdue counts, remaining capacity), never authentication secrets.

## Phase 5.2 Campus Reservation Engine

`POST /api/v1/reservations` allows an authenticated active, verified MEMBER to reserve one eligible physical Campus copy for themselves. The request is `{ "bookId": "<uuid>" }`; member identity comes only from the bearer token, and physical-copy selection stays server-side. LIBRARIAN and ADMIN receive `403` from this self-service route.

The server selects deterministically by copy code from active `AVAILABLE` Campus inventory and performs member/book validation, row locking, ACTIVE Reservation creation, `AVAILABLE → RESERVED`, book-counter synchronization, policy-based expiration, and a `RESERVATION_CREATED` audit entry in one serializable transaction. PostgreSQL partial unique indexes and bounded serialization retries protect competing requests. Duplicate reservations and unavailable/raced inventory return `409`; missing active books return `404`; authentication and role failures return `401`/`403`.

The response contains safe reservation and book data, the assigned copy summary, Campus pickup location, and committed availability counters. It does not contain member authentication/private fields, barcode/QR values, pickup tokens, or internal source/acquisition data. Collection, reservation-to-Loan conversion, member reservation UI, pickup QR, and scanning are not implemented in Phase 5.2.

### Reservation queries, cancellation, and expiration

`GET /api/v1/reservations/me` is MEMBER-only and derives ownership from JWT. It returns deterministic newest-first pagination (`page`, `limit`, maximum 50) and accepts `status=active|cancelled|expired|collected|all`; malformed status, non-integer, non-positive, and oversized pagination values return `400`. `GET /api/v1/reservations/:id` validates UUID format and permits only the owning member. Both return safe book/copy/location data and `canCancel`, never member authentication data, QR/pickup tokens, barcodes, or acquisition/source metadata.

`POST /api/v1/reservations/:id/cancel` locks an owned reservation and atomically changes `ACTIVE → CANCELLED`, releases `RESERVED → AVAILABLE`, synchronizes inventory, and writes one `RESERVATION_CANCELLED` audit event. Missing, foreign, terminal, already-expired, and inconsistent records use the normal `404`/`403`/`409` errors.

Due reservations are processed at backend startup and every 60 seconds by default. `RESERVATION_EXPIRATION_INTERVAL_MS` accepts an integer from 5000 through 2147483647; invalid values fall back to 60000, passes do not overlap within one process, and shutdown clears the timer. Each due row is locked and atomically changed `ACTIVE → EXPIRED` with copy release, counter synchronization, and one system-actor `RESERVATION_EXPIRED` audit. Processing is idempotent and safe across competing workers, and one failed row does not block unrelated candidates. Queries and new creation also defensively process relevant stale rows using the same transition logic. Phase 5.2 did not implement a frontend; collection, pickup/QR/scanning, Loan conversion, and notifications remain unimplemented.

### Phase 5.3.1 frontend integration

Campus Book Details calls the existing `POST /api/v1/reservations` endpoint with `{ "bookId": "<uuid>" }` and the restored or newly issued member access token. It never sends `memberId` or `bookCopyId`. The frontend treats the response as the source of truth for `status`, assigned copy code, pickup location, and formatted `expiresAt`; it does not calculate the reservation window locally. HTTP `401`, `403`, `404`, duplicate/no-copy `409`, and unexpected failures map to localized member-safe feedback while the backend contract and permissions remain unchanged.

## Phase 3 catalog

Public catalog endpoints are available under `/api/v1/books`, including search (`q`), category and language filters, availability filtering, pagination, a slug detail endpoint, and availability by location. `GET /categories`, `/authors`, `/publishers`, `/sections`, and `/shelves` provide active master data for catalog forms.

Librarians and administrators may create or update books and copies, change copy statuses, archive or restore books/copies, and retrieve a copy QR payload. The service validates ISBN/slug/copy-code/barcode uniqueness through database constraints, validates a shelf against its section, and recalculates book availability within the same database transaction as every copy change.

### Administrative archive access

`GET /api/v1/books` remains public and returns active books by default. `archiveState=active|archived|all` (or `includeArchived=true`) is restricted to LIBRARIAN and ADMIN; unauthenticated and MEMBER requests for archived data receive a forbidden response. Search, pagination, sorting, and archive metadata are preserved for those management views.

`GET /api/v1/book-copies` is restricted to LIBRARIAN and ADMIN. It supports `q`, `bookId`, `status`, `condition`, `sectionId`, `shelfId`, `archiveState`, `page`, and `limit`, and returns related book/location data without acquisition details. `GET /api/v1/book-copies/:id` retrieves one active or archived management record.

Restoring a book changes only the book archive state; it does not restore any archived copies. Restoring a copy sets it to `AVAILABLE` and recalculates its book’s `totalCopies` and `availableCopies` transactionally. Archive and restore actions write audit logs.

Administrators additionally manage categories, authors, publishers, sections, and shelves. Each master-data resource supports create, update, archive, and restore. Archive/restore and inventory changes write audit records.

| Role          | Catalog permissions                                            |
| ------------- | -------------------------------------------------------------- |
| Public/member | Browse and search the active catalog                           |
| Librarian     | Manage books, copies, status, QR payloads, and archive/restore |
| Administrator | Librarian permissions plus master-data management              |

```mermaid
sequenceDiagram
  participant C as Client
  participant A as API
  participant D as PostgreSQL
  C->>A: Login credentials
  A->>D: Verify user, store refresh-token hash
  A-->>C: Access token + HTTP-only refresh cookie
  C->>A: Refresh cookie
  A->>D: Validate, revoke, replace session
  A-->>C: New access token + rotated cookie
```
