# Smart Library

Phase 2 adds the PostgreSQL/Prisma foundation, secure authentication, user management, RBAC, Mailpit email flows, and Swagger. Later library features remain scheduled in `docs/implementation-plan.md`.

## Applications

- `apps/backend` — NestJS API foundation (`GET /health`)
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

The services are available at `http://localhost:3000/health`, `http://localhost:5173`, and `http://localhost:8000/health`.

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

## Phase 1 checks

```bash
npm run format
npm run lint
npm run typecheck
npm run test
npm run build
python3 -m compileall -q apps/recommendation-service/app
docker compose config
```
