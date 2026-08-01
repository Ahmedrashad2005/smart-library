# Phase 4 — Borrowing and circulation lifecycle

Loans are issued, returned, and renewed by the API under `/api/v1/loans`. Staff may borrow and return; members may list their own loans and renew only their own eligible active loans. The initial policy is five active loans, 14 days per loan, and two renewals.

| Endpoint                 | Roles                               | Notes                                                                                                                 |
| ------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `POST /loans/borrow`     | LIBRARIAN, ADMIN                    | `memberId` and one of `bookCopyId`, `copyCode`, `barcode`, or `qrCodeValue` are required.                             |
| `POST /loans/:id/return` | LIBRARIAN, ADMIN                    | Requires a valid copy condition; damaged returns remain unavailable.                                                  |
| `POST /loans/:id/renew`  | MEMBER (own loan), LIBRARIAN, ADMIN | Active, eligible loans only; two-renewal maximum.                                                                     |
| `GET /loans/me`          | MEMBER                              | Supports `status`, `page`, and `limit`; always scoped to the caller.                                                  |
| `GET /loans`             | LIBRARIAN, ADMIN                    | Supports `q`, member/book/copy IDs, status, borrowed/due date ranges, pagination.                                     |
| `GET /loans/:id`         | MEMBER (own loan), LIBRARIAN, ADMIN | Returns safe member, book, copy, renewal, and return details. Staff responses include issuer/returner display fields. |

Invalid UUIDs, dates, statuses, and return conditions receive the standard validation error response. Business-rule rejections include ineligible members, unavailable or archived copies, overdue members, active-loan and renewal limits, duplicate returns, and a member attempting to access another member’s loan. A copy that becomes unavailable during a competing borrow and a repeated return produce `409 Conflict`.

Borrowing, return, and renewal use serializable PostgreSQL transactions with a row lock on the book copy and retry serialization failures. Exactly one competing borrow can succeed. Copy state, the loan record, `totalCopies`, `availableCopies`, and the audit record are committed together. Each successful action writes one audit record; rejected competing operations do not. A loan is exposed as overdue whenever it is unreturned and its due date is in the past; no scheduled job is required for correctness.

Returning a good copy makes it `AVAILABLE`; returning a damaged copy preserves the `DAMAGED` copy state and excludes it from availability. Borrow and return responses contain the final committed copy status so the frontend result panel does not infer it locally.

## Phase 4 Part 2 frontend

Staff use `/librarian/loans`, `/librarian/loans/borrow`, `/librarian/loans/:id`, and `/librarian/returns`; these routes require LIBRARIAN or ADMIN. Members use `/my-loans` and `/my-loans/:id`, which call only member-scoped endpoints. The borrow workflow searches an eligibility-safe member summary, then a physical copy by manual copy code, barcode, QR value, or an optional browser camera scan. Manual entry remains available when camera permissions or `BarcodeDetector` are unavailable.

Return processing confirms an allowed copy condition and optional note. Loan lists/details use the backend-provided effective status; browser date helpers are presentation-only. Reservations, fines, payments, notifications, recommendations, and background jobs remain outside this phase.

Member loan lists and details use the shared safe loan response, including a nullable book cover and safe bilingual author display fields. The UI renders a compact initial placeholder when a cover is absent.

## Final Phase 4 verification

- Docker services verified: PostgreSQL, Redis, Mailpit, backend, frontend, and recommendation service.
- Migrations verified in development and isolated test databases, including `borrowing_and_loan_lifecycle`.
- Seed verified: 10 categories, 20 authors, 5 publishers, 5 sections, 15 shelves, 50 books, 130 copies, and four deterministic seed loans (two active, one overdue, one returned).
- Automated verification: 4 backend suites / 25 tests and 14 frontend files / 78 tests, for 103 tests total.
- Live API verification covered borrow, member/staff listing, renewal, normal and damaged returns, duplicate return, competing borrow, inventory counters, audit records, RBAC, archive enforcement, and privacy.
- Live headless-browser verification covered all staff/member circulation routes, search and empty state, filters, manual entry, scanner fallback, dialogs, RTL/LTR, labels, and member route denial. Pagination controls were present; multi-page behavior remains covered by DOM tests because the live verification data fit one page.

The scanner depends on optional browser `BarcodeDetector` and camera permission; manual code, barcode, or QR-value entry is the supported fallback. The 5-loan, 14-day, and two-renewal policy is centralized in `LoanPolicyService` but does not yet have an administrator settings UI. Reservations, waiting lists, fines, payments, waivers, notifications, recommendations, reviews, reports, and dashboards are explicitly outside Phase 4.
