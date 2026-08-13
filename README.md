# NAWA — Unified Knowledge Platform

NAWA has evolved from the original Smart Library Management System into one knowledge platform built around **Buy — Borrow — Read**:

- **NAWA Store** is the marketplace-facing catalog for books, educational products, stationery, technology, and learning tools. Commerce checkout is planned, not part of the current backend.
- **NAWA Campus** uses the proven physical-library, inventory, circulation, RBAC, and audit foundation. It now exposes real university-library holdings and their exact home locations.
- **NAWA Read** is the future digital reading experience. It is documented as product direction only and is not implemented.

The approved light, Arabic-first marketplace homepage remains the public visual direction. Internal workspace/package names retain their historical Smart Library naming to avoid a risky branding-only rename.

Phase 4 circulation remains complete and includes role-protected staff borrowing/return pages (`/librarian/loans`) and member loan pages (`/my-loans`). Manual copy-code, barcode, and QR entry work everywhere; browser camera scanning is used only after an explicit scan action and falls back safely when unsupported. Borrowing, renewal, and returns are transaction-safe and keep copy availability counters synchronized.

Phase 5.1 adds the real College Library Campus holding: Floor 3, Room 315, with all 23 supplied source rows mapped to one physical copy each. See [NAWA Campus](docs/nawa-campus.md) for the data and API contract. Reservation, pickup-ticket/QR, checkout, and digital reading are deliberately outside Phase 5.1.

Phase 5.1.5 integrates that real Campus holding into the approved Store-first marketplace. The public `/campus` page, header entry, homepage `من مكتبة كليتك` shelf, and Campus badges use the established catalog and safe aggregate availability APIs. No Campus books or locations are hardcoded in the UI, and no reservation behavior is present.

Verified Phase 5.1.5 coverage is 5 backend suites / 38 tests and 21 frontend files / 122 tests. Formatting, lint, type checks, tests, builds, the six-service Docker stack, live Campus API queries, and responsive browser checks pass. Phase 5.2 has not started.

## Applications

- `apps/backend` — NestJS API (`GET /api/v1/health`)
- `apps/frontend` — React/Vite/Tailwind development shell
- `apps/recommendation-service` — FastAPI foundation (`GET /health`)

## Prerequisites

- Node.js 18.18+ and npm 9+
- Python 3.12+ (or a compatible supported Python 3 release)
- Docker Engine with the Docker Compose plugin

## Local development

```bash
cp .env.example .env
npm install
python3 -m venv .venv
. .venv/bin/activate
pip install -r apps/recommendation-service/requirements.txt
npm run dev:backend
npm run dev:frontend
npm run dev:recommendations
```

The services are available at `http://localhost:3000/api/v1/health`, `http://localhost:5173`, and `http://localhost:8000/health`.

## Docker development environment

```bash
cp .env.example .env
docker compose up --build
```

This starts PostgreSQL, Redis, Mailpit (`http://localhost:8025`), and the three application services. Swagger is served at `http://localhost:3000/api/docs`.

## Database and development accounts

```bash
npm run prisma:migrate:dev --workspace=@smart-library/backend -- --name init_auth_and_users
npm run prisma:seed --workspace=@smart-library/backend
```

The seed uses `SmartLib123` for `admin@smart-library.test`, two librarian accounts, and 15 member accounts. These credentials are development-only.

The established Store-facing seed includes 50 bilingual books, 130 physical copies, and four deterministic loans. The Campus import adds 23 authoritative source rows and one physical Campus copy per row without replacing the wider catalog. The isolated test database is `smart_library_test`.

Verified Phase 5.1 coverage is 5 backend suites / 37 tests and 19 frontend files / 111 tests. Phase 5.0 and Phase 5.1 are complete; Phase 5 as a whole remains in progress.

## Project checks

```bash
npm run format
npm run lint
npm run typecheck
npm run test
npm run build
python3 -m compileall -q apps/recommendation-service/app
docker compose config
```
