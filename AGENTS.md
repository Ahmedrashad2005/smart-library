# Delta University Library — Permanent Project Guide

## Source of truth and scope

The complete specification at `/home/ahmed/Desktop/python videos/4-lists/Smart Library Management System.pdf` remains the original functional source of truth. Approved phase instructions extend it and take precedence where older public product framing conflicts with the current direction. This file records enduring engineering rules; it does not reduce either source.

The primary public product and visible institution are **Delta University Library / مكتبة جامعة الدلتا**, with **Delta University for Science and Technology** as secondary institutional wording. NAWA is the underlying platform and may appear publicly only as a restrained **Powered by NAWA** signature. The existing library system, Campus catalog, circulation, reservation, authentication, and member functionality remain the technical foundation. Implement features in the required phases in `docs/implementation-plan.md`. Do not add fake controls, placeholder product flows, or TODOs for required functionality. Preserve useful existing code and keep changes scoped to the active phase.

Do not rename internal packages, services, database identifiers, or the local repository solely for branding. Do not restore the obsolete Smart Library public UI, make Store/commercial language dominant, or make the public experience look like library-management software. Preserve the central `Book` model and existing Store-capable internals without promoting Buy flows in the student experience.

## Delta University identity and faculty rules

- Delta University Library is the dominant identity in the header, first viewport, search, account experience, and student-facing copy. NAWA must never compete visually with it.
- Use an official Delta University logo only. Never generate, redraw, imitate, or substitute an unofficial mark. The drop-in location is `apps/frontend/public/branding/delta-university/delta-university-logo.png`; until it is supplied, show the bilingual institutional wordmark and hide the failed image cleanly.
- Preserve the approved organized Arabic bookstore-style information hierarchy inspired by Jarir: strong search and book presentation, dense but orderly discovery, light surfaces, restrained borders/shadows, and polished RTL. Do not copy Jarir branding, assets, colors, wording, or exact layouts.
- The faculty foundation is localization-ready and intentionally contains only the 13 confirmed Arabic names. Do not invent faculty #14, official English faculty names, departments, or book/faculty associations. Add them only from confirmed institutional data.
- Never mutate, delete, or reassign real loans, reservations, or catalog records merely to populate a design or fixture. Automated database fixtures must stay isolated from development data.

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
- The Delta University Library AI Assistant is the primary user-facing AI surface. It reuses the existing recommendation pipeline and exposes only fixed, read-only tools for catalog search, availability/location, member Loans/Reservations, and academic help. Gemini never owns library facts or member identity; do not add chat write actions or permanent memory without a separately approved phase.
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

## Delta University Library frontend design system (mandatory)

All future frontend work must follow `docs/frontend-design-system.md`. It is the authoritative visual and interaction reference for the Delta University Library experience. Preserve the established Arabic bookstore-style visual rhythm across public, member, librarian, and admin work while adapting each page to its function.

- The customer-facing brand is Delta University Library; NAWA is a subtle platform credit. Do not rename internal packages, services, database identifiers, or historical technical documentation solely for branding.
- Delta University blue `#0067A9` is the primary interface accent, with deep blue `#073F70`, pale blue `#EAF5FC`, and restrained university orange `#F58220`. White and off-white remain the dominant surfaces. These interface tokens are sampled visual companions to the supplied identity reference, not permission to redraw or alter the official mark.
- Use the official Delta University asset path documented above. Do not redraw, distort, recolor, add effects to, or fabricate the primary logo. Existing NAWA assets remain available only for subtle platform attribution and historical/internal screens.
- Treat the approved public homepage as a design-language reference, not as a layout template for every page. Reuse its color, typography, spacing, border, radius, shadow, button, input, card, icon, badge, navigation, and feedback patterns.
- Arabic is the primary polished public presentation and RTL must be designed deliberately. English LTR must remain equally usable and coherent.

- Use a modern, light, clean, simple, and welcoming interface. White and soft off-white surfaces are the default; do not use pure-black backgrounds or dark navigation by default.
- Use the documented Delta-blue-led interface palette, restrained orange accents, very sparse gold details, warm cream surfaces, tokens, spacing, typography, borders, shadows, status patterns, and component rules consistently. Orange, teal, coral, and unrelated legacy accents must not compete with Delta blue in newly created or redesigned components.
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
