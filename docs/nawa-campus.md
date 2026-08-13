# NAWA Campus — Phase 5.1

## Product context

The product began as a Smart Library Management System and has evolved into **NAWA — Unified Knowledge Platform**:

- **NAWA Store**: the knowledge-oriented marketplace presentation. The current public homepage/catalog remain intact; checkout, payments, shipping, and order workflows are not part of Phase 5.1.
- **NAWA Campus**: the existing secure library, physical inventory, and circulation foundation, now connected to the real college-library location and supplied holdings.
- **NAWA Read**: a future digital-reading capability. No digital asset, reader, bookmark, progress, or offline-reading model is introduced here.

`Book` remains the central catalog concept so later Store, Campus, and Read capabilities can coexist. Phase 5.1 does not implement reservations, waitlists, pickup tickets, reservation QR codes, or reservation scanners.

## Real location and source policy

The only supplied physical hierarchy is:

| Level    | English         | Arabic       | Stored value                       |
| -------- | --------------- | ------------ | ---------------------------------- |
| Library  | College Library | مكتبة الكلية | stable code `NAWA-COLLEGE-LIBRARY` |
| Floor    | Third Floor     | الدور الثالث | `3`                                |
| Room     | Room 315        | غرفة 315     | `315`                              |
| Building | Not supplied    | غير متوفر    | `null`                             |

The provided university inventory is authoritative. All 23 rows are represented by stable source references `NAWA-CAMPUS-PDF-001` through `NAWA-CAMPUS-PDF-023`, with one physical Campus `BookCopy` per row. The unknown source `NO` column is not interpreted as quantity.

Data is preserved rather than guessed:

- raw publication/publisher-place text is stored in `Book.sourcePublicationInfo`; it is not converted into a fabricated normalized Publisher or enriched from the web;
- one missing publication value and one missing year remain null;
- `Introduction to Biomedical Engineering` retains the supplied DDC `621`;
- opaque shelf-location values are stored verbatim on `BookCopy.shelfLocationCode`, including Big Java's `1,2/1`;
- only the three supplied groups are mapped: `Cyber Security / Communication`, `Bio Informatics`, and `AI / General Programming / ML-DL / Processing`; the first 12 ungrouped rows remain ungrouped rather than receiving an invented source category;
- authors are reused only through exact case-insensitive name matching; books are reused only by a conservative exact title/year/author match.

The seed is idempotent. It uses the source reference to update an existing Campus copy, preserves its current operational status on reseed, and synchronizes parent book counters. It never truncates the wider Store catalog.

## Location architecture

`Library` → `LibraryFloor` → `LibraryRoom` normalizes the real hierarchy. Existing `LibrarySection` and `Shelf` records remain the internal organizational layer and are connected to Room 315. A neutral technical holding shelf anchors rows that have no supplied semantic group; it does not reinterpret the source shelf code.

`BookCopy.homeLibraryRoomId` and `shelfLocationCode` describe where a copy belongs. `BookCopy.status` describes its current circulation state. They are intentionally independent: a borrowed or unavailable copy keeps its Floor 3 / Room 315 / source-shelf home location.

Indexes support active hierarchy reads, room/status inventory queries, and source shelf lookup. Unique constraints protect library codes, floor numbers within a library, room numbers within a floor, and source-row references.

## API and authorization

Public clients may read the safe active library hierarchy through `GET /api/v1/libraries` and `GET /api/v1/libraries/:id`. Book Details and availability responses include a shared safe Campus view with aggregate availability and location display fields. They do not expose internal source references, barcodes, QR data, acquisition notes, audit metadata, or user/authentication fields.

ADMIN may create/update libraries, floors, and rooms. These writes validate active parents and produce audit records. LIBRARIAN and ADMIN continue to manage book-copy assignments/status through established copy endpoints; MEMBER/public clients are read-only. This preserves the existing RBAC split.

## Frontend experience

Book Details adds a compact NAWA Campus card without changing the approved marketplace homepage or header. It displays a text/icon availability state, available/total counts, the localized library, Floor/Room, exact shelf code, and an accessible `View location` action. Store-only books receive a neutral not-held state with no fake reservation action.

The location dialog is keyboard operable, labelled with native dialog semantics, focuses its Close control on open, closes with Escape/backdrop, retains Tab focus, and returns focus to its trigger. Arabic RTL and English LTR strings use the same light NAWA design tokens. Null publication/year fields are omitted safely; DDC appears only when present.

## Phase 5.2 compatibility and boundary

Future reservations may move a physical copy from AVAILABLE to RESERVED to LOANED and will need the existing copy identity and home/pickup location. A future reservation/pickup QR must be distinct from the existing physical-copy QR. Phase 5.1 provides the location and availability foundation but creates no Reservation model or behavior.

## Phase 5.1.5 public marketplace integration

NAWA Campus is discoverable inside the approved Store-first marketplace without turning the product into a university dashboard:

- the preserved two-level header exposes `مكتبة الكلية` / `Campus Library` through the existing category, services, and compact-mobile navigation patterns;
- `/campus` is a lightweight marketplace discovery page that reads the public library hierarchy and therefore displays the real Floor 3 / Room 315 data rather than duplicating the location in frontend code;
- the Campus page reuses catalog cards, skeletons, empty/error feedback, search, pagination, an available-now filter, and only the three supplied source groups;
- the homepage includes a real `من مكتبة كليتك` shelf of currently available Campus books with `عرض الكل` linked to `/campus`;
- catalog and shelf cards use safe aggregate Campus availability to distinguish available and currently unavailable holdings without exposing copy identifiers;
- the internal seeded category wording `مخزون الكلية — غير مصنف` is mapped at the public presentation boundary to `كتب مكتبة الكلية`; stored source data is unchanged;
- long category labels use a bounded two-line treatment, accessible names/tooltips, and the established keyboard/touch horizontal scroller.

The hero retains its approved structure and illustration while broadening its copy to books, learning tools, and technology. The Campus UI uses the same Navy/Coral/Gold/Cream language, responsive breakpoints, RTL/LTR behavior, and focus/semantic patterns as the wider marketplace.

The marketplace retail refinement keeps this integration Store-first while increasing product density. The homepage Campus shelf now follows the same flat retail rhythm as the other real-data shelves, `/campus` uses a compact breadcrumb/header/filter composition, and its shared cards use portrait book media plus the deterministic NAWA fallback. Book Details presents Campus availability as a separate acquisition panel beside the cover and bibliographic information on wide screens, then stacks it safely on smaller screens. These are presentation changes only: the same public APIs, real hierarchy, status rules, circulation behavior, and no-reservation boundary remain authoritative.

This integration adds no reservation call-to-action, Reservation model/status, reservation QR, pickup ticket, waitlist, NAWA Read, offline reading, or commerce backend.

### Verified Phase 5.1.5 result

- The live Campus catalog returns all 23 real holdings across five five-item pages and only the three supplied source groups; public search, Campus availability filtering, and exact source-group filtering were exercised.
- The live library hierarchy supplies `مكتبة الكلية` → `الدور الثالث` → `غرفة 315`; the UI does not duplicate or invent a building/location.
- Operating System Concepts retains shelf code `2/1`, and Big Java retains `1,2/1`, in the existing Book Details Campus experience.
- Automated verification closes with 5 backend suites / 38 tests and 21 frontend files / 122 tests. The frontend coverage includes the Campus route/page, live-data boundaries, homepage shelf, navigation, badges, categories, RTL location, safe states, and the preserved Book Details flow.
- Formatting, linting, strict type checking, tests, production builds, and the rebuilt six-service Docker stack pass.
- Manual browser verification covered the approved homepage and Campus page at 1440 px, 900 px, and 390 px, plus both required Book Details examples. No horizontal overflow or reservation action was observed.

Phase 5.1.5 is complete. Phase 5 as a whole remains in progress, and Phase 5.2 has not started.

Phase 5.0 and Phase 5.1 can be closed independently after migration, seed, test, build, Docker, data, and manual verification. **Phase 5 as a whole remains in progress.**

## Verified Phase 5.1 result

- Migration `20260809003000_nawa_campus_location_structure` is applied to both `smart_library` and isolated `smart_library_test`; all four project migrations are current.
- The first deterministic import created 23 new Book records and 23 Campus BookCopies. A subsequent seed reused all 23 Books and created no duplicate Book or BookCopy.
- Development data contains 73 Books and 153 BookCopies in total: the established 50/130 catalog plus the 23/23 Campus import.
- Source validation found 23 source references, 23 distinct Campus Books, 23 Campus copies, one missing publication value, one missing year, three explicit source groups, and one supplied DDC record.
- Automated verification closes with 5 backend suites / 37 tests and 19 frontend files / 111 tests.
- Docker runs PostgreSQL, Redis, Mailpit, backend, frontend, and recommendation service; application and infrastructure health endpoints respond successfully.
- Live browser checks covered the approved homepage, Operating System Concepts, Big Java, Wireless Communications, and Introduction to Biomedical Engineering at desktop, tablet, and phone widths.
- A live Phase 4 borrow/return cycle confirmed that a borrowed Campus copy becomes unavailable without losing its home location, then returns to AVAILABLE with synchronized counters.

Phase 5.0 and Phase 5.1 are complete. Phase 5.2 and the rest of Phase 5 are not started/complete.
