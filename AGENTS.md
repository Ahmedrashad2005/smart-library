# NAWA Unified Knowledge Platform — Permanent Project Guide

## Source of truth and scope

The complete specification at `/home/ahmed/Desktop/python videos/4-lists/Smart Library Management System.pdf` remains the original functional source of truth. The approved NAWA product-evolution and phase instructions extend it and take precedence where the old public product framing conflicts with the current direction. This file records enduring engineering rules; it does not reduce either source.

The current product is **NAWA — Unified Knowledge Platform**, not a mock-up. Its long-term structure is NAWA Store (knowledge marketplace), NAWA Campus (physical university library), and NAWA Read (future digital reading), organized around **Buy — Borrow — Read**. The original library system is preserved as the technical foundation of NAWA Campus. Implement features in the required phases in `docs/implementation-plan.md`. Do not add fake controls, placeholder product flows, or TODOs for required functionality. Preserve useful existing code and keep changes scoped to the active phase.

Do not rename internal packages, services, database identifiers, or the local repository solely for branding. Do not restore the obsolete Smart Library public UI or make the public marketplace look like library-management software. A central `Book` must remain capable of receiving Store, Campus, and later Read capabilities without becoming Campus-only.

## Monorepo and technology stack

```text
apps/backend                 NestJS REST API
apps/frontend                React/Vite web client
apps/recommendation-service  FastAPI recommendation API
docker/                      Container definitions
docs/                        Living project documentation
```

- Backend: Node.js, NestJS, TypeScript (strict), PostgreSQL, Prisma, REST, JWT with rotated hashed refresh tokens, Passport, class-validator, Redis, BullMQ, Nodemailer, QR generation, Swagger/OpenAPI, Jest, and Supertest.
- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form, Zod, Axios, Recharts, and a modern icon library.
- Recommendations: Python, FastAPI, Pandas, scikit-learn, TF-IDF/cosine-similarity content recommendations.
- Operations: Docker Compose with PostgreSQL, Redis, Mailpit, backend, frontend, recommendation service, optional Nginx; health checks; GitHub Actions.

Use npm workspaces for JavaScript applications and Python virtual environments for the recommendation service. Add dependencies only when the active phase needs them.

## Architecture and API rules

- Use modular NestJS modules. Controllers are thin; services own business rules; use DTOs with validation. Use repository abstractions only when they genuinely help.
- The public API is REST under `/api/v1`. Use a global exception filter and response interceptor. Success responses follow `{ success, message, data, meta }`; errors include `success`, `statusCode`, `message`, field errors, ISO timestamp, and request path.
- Use Prisma with normalized PostgreSQL entities, UUID primary keys, timestamps where appropriate, and archive/soft-delete fields for critical data. Add DB constraints and indexes as well as application validation.
- Use transactions and concurrency-safe updates for borrowing, returns, reservations, reservation assignment, fine payments, and availability counters. Never permit duplicate active reservations, a double-borrowed copy, or negative availability.
- The NestJS API consumes the FastAPI recommendation service. On its unavailability, return a popular-books fallback rather than fail the request.
- Configuration comes from environment variables. Never commit secrets, credentials, access tokens, or real user data.

## Security and access control

- Roles: `MEMBER`, `LIBRARIAN`, `ADMIN`; enforce authorization on every protected operation and route.
- Implement registration, verification, login/logout, password reset/change, token revocation, blocked-account enforcement, rate limits, secure password hashing, security headers, CORS, validation, audit logging, and SQL-injection-safe Prisma access.
- Use short-lived access tokens and rotated refresh tokens. Hash refresh tokens in storage and use secure HTTP-only cookies whenever feasible; do not put them in insecure browser storage.
- Audit sensitive login, role/user status, catalog/copy, circulation, fine, and settings actions. Only admins can access complete audit logs.

## Required product capabilities

- Bilingual English/Arabic UI with LTR/RTL support, responsive and accessible desktop/tablet/mobile behavior, loading/error/empty states, keyboard navigation, semantic labels, contrast, focus states, and screen-reader status messages.
- Catalog management for books, multiple authors, categories, publishers, sections, floors/rooms, and shelves. Each physical copy has unique copy/barcode/QR codes, status, condition, and exact visible location.
- Catalog search covers title, subtitle, author, ISBN, category, publisher, description, and shelf; includes filters, sorting, pagination, PostgreSQL full-text/trigram typo tolerance, suggested corrections, and deletable search history.
- Circulation enforces configurable limits, due dates, renewal rules, fines, and transactions. Returns calculate fines and assign an eligible FIFO reservation. Members see availability, queue positions, history, renewals, fines, and notifications.
- Support QR member/copy generation and scan/manual-entry circulation, reviews by verified borrowers, book requests, damaged/missing/information/location reports, in-app/development email notifications, scheduled jobs, and personalized/popular/similar recommendations with explanations.
- Provide member, librarian, and admin dashboards; reports, charts, system settings, user and role administration, and all specified REST endpoints.
- Deliver migrations, realistic fake seed data, automated backend/frontend tests, Swagger, Docker, CI, and the requested documentation set before final completion.

## NAWA frontend design system (mandatory)

All future frontend work must follow `docs/frontend-design-system.md`. It is the authoritative visual and interaction reference for the NAWA product experience. The approved Arabic public-homepage reference is the visual North Star for the entire platform; preserve this identity across future public, member, librarian, and admin work while adapting each page to its function.

- The customer-facing brand is `NAWA`, Arabic `نَوَى`. Do not rename internal packages, services, database identifiers, or historical technical documentation solely for branding.
- The permanent brand palette is NAWA Navy `#102F5E`, Coral `#E86A6A`, Gold `#D9A441`, and Cream `#FFF9F4`. Colored interface emphasis follows an approximate 70% navy, 20% coral, and 10% gold ratio; white and light neutral surfaces may occupy most of a page.
- Use the approved logo assets in `apps/frontend/public/brand/`. Do not redraw, distort, recolor ad hoc, or add gradients/effects to the primary logo. Use full-color on light surfaces, navy monochrome where reduced color is required, white on dark brand surfaces, and black only where required.
- Treat the approved public homepage as a design-language reference, not as a layout template for every page. Reuse its color, typography, spacing, border, radius, shadow, button, input, card, icon, badge, navigation, and feedback patterns.
- Arabic is the primary polished public presentation and RTL must be designed deliberately. English LTR must remain equally usable and coherent.

- Use a modern, light, clean, simple, and welcoming interface. White and soft off-white surfaces are the default; do not use pure-black backgrounds or dark navigation by default.
- Use the documented navy-led NAWA palette, restrained coral emotional accents, very sparse gold premium details, warm cream surfaces, tokens, spacing, typography, borders, shadows, status patterns, and component rules consistently. Teal and unrelated legacy accents must not remain dominant in newly created or redesigned components.
- Favor generous whitespace, a clear visual hierarchy, moderate corner radii, subtle borders, and very light shadows. Keep forms, cards, tables, filters, and dashboards easy to scan.
- Do not introduce heavy, crowded, futuristic, neon, gaming, glassmorphism, glowing, or decoration-first visual treatments. Avoid excessive gradients and animation, and do not expose too many controls at once.
- Design for students, librarians, administrators, older users, and small touch screens. English LTR and Arabic RTL must be equally polished rather than mirrored as an afterthought.
- Implement accessible labels, keyboard behavior, visible focus states, semantic status messages, sufficient color contrast, and non-color status cues. Use the documented loading, empty, error, modal, and confirmation patterns.
- Never build a polished-looking placeholder with non-functional controls. Product pages and controls must be implemented only in their scheduled phase.

## Engineering conventions

- TypeScript is strict. Avoid `any`, duplicated validation/business logic, giant services, hardcoded URLs/secrets, unused files, and comments that merely restate code. Prefer clear naming and small cohesive modules.
- Use Prettier and ESLint. Use typed API contracts, a centralized Axios client, React Query hooks, reusable frontend components, lazy routes, debounced search, and cache invalidation after writes.
- Treat availability, status transitions, fine math, reservation order, authorization, and notification delivery as business-critical. Return clear rejection reasons.
- Before closing a phase, run its relevant formatting/lint/type/test/build checks and fix failures rather than suppressing them. Update the implementation checklist and documentation when plans or architecture change.
