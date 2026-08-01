# Phase 4 Part 1 — Borrowing lifecycle

Loans are issued, returned, and renewed by the API under `/api/v1/loans`. Staff may borrow and return; members may list their own loans and renew only their own eligible active loans. The initial policy is five active loans, 14 days per loan, and two renewals.

| Endpoint                 | Roles                               | Notes                                                                                     |
| ------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `POST /loans/borrow`     | LIBRARIAN, ADMIN                    | `memberId` and one of `bookCopyId`, `copyCode`, `barcode`, or `qrCodeValue` are required. |
| `POST /loans/:id/return` | LIBRARIAN, ADMIN                    | Requires a valid copy condition; damaged returns remain unavailable.                      |
| `POST /loans/:id/renew`  | MEMBER (own loan), LIBRARIAN, ADMIN | Active, eligible loans only; two-renewal maximum.                                         |
| `GET /loans/me`          | MEMBER                              | Supports `status`, `page`, and `limit`; always scoped to the caller.                      |
| `GET /loans`             | LIBRARIAN, ADMIN                    | Supports `q`, member/book/copy IDs, status, borrowed/due date ranges, pagination.         |
| `GET /loans/:id`         | MEMBER (own loan), LIBRARIAN, ADMIN | Returns safe member, book, copy, issuer, renewal, and return details.                     |

Invalid UUIDs, dates, statuses, and return conditions receive the standard validation error response. Business-rule rejections include ineligible members, unavailable or archived copies, overdue members, active-loan and renewal limits, duplicate returns, and a member attempting to access another member’s loan.

Borrowing, return, and renewal use serializable PostgreSQL transactions with a row lock on the book copy. Each action writes an audit record. A loan is exposed as overdue whenever it is unreturned and its due date is in the past; no scheduled job is required for correctness.

Returning a damaged copy preserves the `DAMAGED` copy state and excludes it from availability. Restoring, fines, reservations, notifications, and circulation UI are outside Phase 4 Part 1.
