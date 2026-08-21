# Delta University Library branding and faculties foundation

## Product identity

Delta University Library (`مكتبة جامعة الدلتا`) is the primary student-facing identity. `Delta University for Science and Technology` is secondary institutional wording. NAWA remains the technical platform and appears only as a restrained `Powered by NAWA` attribution.

The public experience keeps the established light, organized Arabic bookstore-style hierarchy: prominent search, strong book presentation, compact discovery sections, polished RTL, and responsive navigation. This is an interaction and information-density reference only; no retailer branding, assets, colors, wording, or exact layouts are copied.

The official Delta University logo was not present in the repository when this foundation was implemented. Supply the approved file at:

```text
apps/frontend/public/branding/delta-university/delta-university-logo.png
```

The header preserves the logo area and hides a missing image cleanly while retaining the bilingual institutional wordmark. Never use a generated or unofficial substitute.

## Faculty data model

`Faculty` is a small localization-ready master entity. `BookFaculty` is an explicit many-to-many relation so a book can belong to multiple academic faculties without becoming Campus-only. The relation contains no department or invented academic hierarchy.

Public endpoints:

- `GET /api/v1/faculties` — ordered active faculties with safe `bookCount`.
- `GET /api/v1/faculties/:slug` — one active faculty with safe `bookCount`.
- `GET /api/v1/books?facultySlug=:slug` — the existing public catalog response filtered by a real faculty assignment.

Public frontend routes:

- `/faculties`
- `/faculties/:slug`

When a faculty has no assigned books, its page presents a truthful empty state. Existing books are not assigned automatically.

## Confirmed faculty data

Only these 13 Arabic names are installed:

1. كلية الطب البشري
2. كلية طب الفم والأسنان
3. كلية الطب البيطري
4. كلية العلاج الطبيعي
5. كلية الصيدلة
6. كلية تكنولوجيا العلوم الصحية
7. كلية التمريض
8. كلية هندسة الطاقة والبترول
9. كلية الهندسة
10. كلية الذكاء الاصطناعي
11. كلية الحقوق
12. كلية الإدارة
13. كلية الآداب

The product direction mentions 14 faculties, but faculty #14 has not been confirmed. It is intentionally absent. Official English labels are also `null` until confirmed by institutional source material; the English UI displays the confirmed Arabic label with correct RTL direction rather than inventing a translation.

## Data-safety rules

- The migration is additive and does not modify books, loans, reservations, copy state, or inventory counters.
- The migration inserts only the confirmed faculty master rows.
- The normal seed can create the same master rows for a fresh database, but no book/faculty links are seeded.
- Database-backed tests create and remove only their isolated test relation fixtures.
