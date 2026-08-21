# Delta University Library frontend design system — V2

## Purpose and visual direction

Design System V2 is the mandatory reference for all Delta University Library frontend work. The approved Arabic public homepage remains the visual North Star: a light, premium, welcoming university-library experience with an Arabic-first polished RTL presentation and the organized discovery rhythm of a mature bookstore. Future public, member, librarian, and admin pages must feel like one product without copying the homepage layout into functional workspaces.

The primary customer-facing name is `Delta University Library`, Arabic `مكتبة جامعة الدلتا`. `Delta University for Science and Technology` is secondary institutional wording. NAWA is the underlying product platform and appears publicly only as a small `Powered by NAWA` credit. Internal package, service, database, and existing CSS-token names remain unchanged unless a separate engineering task explicitly requires a rename. Delta University blue leads the interface, university orange supplies a restrained secondary accent, Gold is a rare detail, and Cream supplies warmth. These interface colors support the supplied identity reference; they do not authorize a fabricated or altered university mark.

White and very light neutral surfaces are the default. Use compact, elegant spacing, clear hierarchy, familiar controls, thin borders, medium radii, refined cards, and restrained depth. Do not use dark navigation, pure-black backgrounds, crowded or dashboard-heavy public layouts, glassmorphism, neon or glowing effects, gaming or futuristic treatments, or decoration-first animation.

## Approved public-page composition

The public homepage follows this order: slim utility bar, Delta University brand/navigation/prominent search header, split library hero with book imagery and message, inline trust row, prominent `Delta University Faculties`, the real category strip, useful discovery shelves, and the university-library feature strip, followed by a subtle `Powered by NAWA`. `/books` preserves the same identity and adds the functional searchable, filterable, paginated full catalog. Do not display fake purchase, delivery, payment, AI, or catalog controls.

## Organized bookstore-style library structure

The approved high-traffic Arabic bookstore reference, including the Jarir-inspired direction, informs information hierarchy, density, header proportions, category browsing, and shelf rhythm only. It does not authorize copying Jarir or any other retailer's branding, colors, artwork, icons, catalog text, proprietary assets, trade dress, or exact layouts. Delta University Library remains visibly and semantically the primary institution at every viewport.

- Desktop uses a compact two-row header: a 44–50px utility row and an 82–94px main row. The responsive Delta University logo/wordmark treatment occupies roughly 210–270px, while navigation and subject controls remain subordinate to the flexible catalog search. Intentionally circular controls are limited to true icon actions.
- The hero retains the approved book illustration and trust rhythm, but its identity and copy are unmistakably Delta University Library. It stays compact enough that faculties, categories, and books enter the first reading sequence quickly. Mobile uses a dedicated compact composition rather than a mechanically shrunken desktop hero.
- Category and faculty labels are public, localized, and concise. Internal inventory names never appear in student browsing. Rails and grids preserve touch, keyboard, RTL/LTR behavior, named controls, and visible active states.
- Homepage shelves use subtle separators and content rhythm instead of placing every shelf inside a large floating card. A normal desktop view should show approximately five to seven compact products when real data permits it.
- Book media uses a portrait `2:3` ratio. A missing or failed image uses the shared deterministic library-cover fallback, never a generic landscape tile or an invented external image.
- Campus remains an integrated retail shelf and a focused catalog route. It uses the same book cards, safe real availability, and real Floor 3 / Room 315 hierarchy. It is not presented as a separate dashboard, and it never implies reservation behavior before that phase exists.
- Book Details uses a discovery-and-borrowing composition: portrait cover, readable bibliographic information, and a distinct safe Campus availability panel. Existing reservation and borrowing actions remain real; commercial purchase language is not promoted.
- Default page background is `#FAFBFD`; routine content surfaces are white, and warm editorial emphasis may use `#FFF9F4`. Thin borders, 12–16px card radii, and minimal shadows are preferred over nested cards, oversized pills, or floating panels.

## Design tokens

### Existing semantic aliases (migration only)

The following aliases remain in older screens so this scoped refresh does not accidentally redesign unrelated product pages. Do not use them as the color source for new or redesigned work; use the NAWA North Star tokens below.

| CSS token           | Value     | Use                                       |
| ------------------- | --------- | ----------------------------------------- |
| `--blue-50`         | `#EFF6FF` | Selected and informational backgrounds    |
| `--blue-100`        | `#DBEAFE` | Focus rings and light blue emphasis       |
| `--blue-200`        | `#BFDBFE` | Focused or hovered borders                |
| `--blue-600`        | `#2563EB` | Primary actions and active navigation     |
| `--blue-700`        | `#1D4ED8` | Primary hover and strong blue text        |
| `--teal-50`         | `#F0FDFA` | Light supporting emphasis                 |
| `--teal-100`        | `#CCFBF1` | Teal highlights                           |
| `--teal-500`        | `#14B8A6` | Decorative supporting accents             |
| `--teal-600`        | `#0D9488` | Secondary actions and eyebrow text        |
| `--teal-700`        | `#0F766E` | Strong secondary text                     |
| `--red-50`          | `#FFF1F2` | Very light featured/decorative accent     |
| `--red-100`         | `#FFE4E6` | Muted icon and category accent            |
| `--red-200`         | `#FECDD3` | Warm dividers and accent borders          |
| `--red-400`         | `#FB7185` | Small decorative details                  |
| `--red-500`         | `#E85D6A` | Selected accents and illustration details |
| `--red-600`         | `#D94A58` | Muted-red interaction emphasis            |
| `--red-700`         | `#B93B49` | Readable text on pale red surfaces        |
| `--page-background` | `#F5F7FB` | Default page background                   |
| `--surface`         | `#FFFFFF` | Cards, inputs, menus, tables, and dialogs |
| `--surface-muted`   | `#F1F5F9` | Skeletons and secondary surfaces          |
| `--surface-cool`    | `#F3F7FD` | Category and cool browse sections         |
| `--surface-warm`    | `#FFF8F6` | Recently added and warm browse sections   |
| `--surface-mint`    | `#F1FBF8` | Available-now and teal-led sections       |
| `--text-primary`    | `#172033` | Headings and primary body text            |
| `--text-secondary`  | `#64748B` | Metadata and supporting text              |
| `--border-soft`     | `#E6EAF1` | Cards and subtle structural separation    |
| `--border-strong`   | `#D9E0EA` | Filters, menus, and clearer separation    |
| `--success`         | `#16A34A` | Available and successful states           |
| `--warning`         | `#D97706` | Warning and unavailable states            |
| `--error`           | `#DC2626` | Errors and destructive actions            |

### Delta University interface tokens

The `delta-` tokens are the canonical branding source. Historical `nawa-` aliases remain temporarily mapped to them so established screens can adopt the identity consistently without an unrelated broad selector migration.

| CSS token               | Value     | Use                                               |
| ----------------------- | --------- | ------------------------------------------------- |
| `--delta-blue`          | `#0067A9` | Primary actions, links, navigation, brand accents |
| `--delta-blue-hover`    | `#005188` | Hover and pressed state                           |
| `--delta-blue-deep`     | `#073F70` | Strong headings and high-contrast identity text   |
| `--delta-blue-soft`     | `#EAF5FC` | Selected controls and icon backgrounds            |
| `--delta-blue-pale`     | `#F5FAFF` | Large, very light supporting surfaces             |
| `--delta-blue-border`   | `#BCD9EC` | Branded focus and structural borders              |
| `--delta-orange`        | `#F58220` | Small secondary identity accents                  |
| `--delta-orange-hover`  | `#D96608` | Orange hover state                                |
| `--delta-orange-dark`   | `#B95105` | Accessible orange text                            |
| `--delta-orange-soft`   | `#FFF1E5` | Pale secondary accent surface                     |
| `--nawa-gold`           | `#D9A441` | Rare premium, star, and achievement detail        |
| `--nawa-cream`          | `#FFF9F4` | Warm editorial surface                            |
| `--nawa-white`          | `#FFFFFF` | Main card and control surface                     |
| `--nawa-background`     | `#FAFBFD` | Page background                                   |
| `--nawa-text-primary`   | `#1F2F46` | Primary body text                                 |
| `--nawa-text-secondary` | `#66758A` | Supporting copy and metadata                      |
| `--nawa-border`         | `#DCE8F1` | Thin, blue-aware structural border                |

Semantic aliases are `--color-primary`, `--color-primary-hover`, `--color-accent`, `--color-premium`, `--color-page-background`, `--color-surface`, `--color-warm-surface`, `--color-text`, `--color-text-muted`, and `--color-border`. Use them instead of repeating raw values.

Colored interface emphasis follows approximately 80% Delta blue, 15% university orange, and 5% gold. This ratio does not include white, cream, or neutral page area. Blue remains strategic rather than becoming an entire-page fill; orange never becomes the main page background, and Gold never becomes a primary button, body-text, or dominant background color. Status meaning always includes readable text or an icon rather than relying on color.

### Logo and attribution system

The official Delta University logo must be placed at `apps/frontend/public/branding/delta-university/delta-university-logo.png`. Until that file is supplied, the interface hides the failed image cleanly and renders the bilingual institutional wordmark; it must not generate, redraw, approximate, or substitute a fake logo. When supplied, preserve its geometry, clear space, and aspect ratio, and size wide variants so they do not damage header proportions.

Existing assets in `apps/frontend/public/brand/` are NAWA platform assets, not the primary university identity. They may be used only for a subtle `Powered by NAWA` attribution where appropriate. Do not recolor, distort, or place NAWA at a scale that competes with Delta University.

### Pastel palette

| CSS token         | Value     | Approved use                             |
| ----------------- | --------- | ---------------------------------------- |
| `--pastel-sky`    | `#EAF4FF` | Category tile or no-cover background     |
| `--pastel-mint`   | `#EAFBF5` | Category tile or supporting highlight    |
| `--pastel-amber`  | `#FFF5DA` | Category tile or restrained warning area |
| `--pastel-rose`   | `#FFECEF` | Category tile or restrained error accent |
| `--pastel-violet` | `#F4EEFF` | Category tile or no-cover background     |

Pastels identify browseable groups and soft supporting areas. They must not replace white surfaces across entire data-heavy pages.

### Gradient limitations

Gradients are optional and limited to subtle large decorative areas such as a hero or no-cover placeholder. Approved public heroes blend Delta blue-soft, white, and a small orange-soft edge without making orange dominant. Gradients are forbidden in the primary official logo and must not appear on routine buttons, inputs, tables, navigation, status badges, or every card. Never use glowing, high-saturation, animated, or multi-layer decorative gradients.

## Typography

- English uses `Inter`, then the native system sans-serif stack.
- Arabic uses `Cairo`, `Tajawal`, `Noto Sans Arabic`, then the native system sans-serif stack.
- Body text is normally 16px with a 1.5–1.7 line height. Do not use body text below 14px.
- Page titles are normally 30–48px depending on viewport and context; section titles 22–27px; card titles 16–18px; metadata 14px.
- Headings must remain compact and must not create oversized, mostly empty hero regions.
- Arabic copy receives a slightly more generous line height and no artificial uppercase tracking.

## Spacing, shape, and depth

- Spacing scale: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64px`.
- Prefer 16–24px inside cards and 32–48px between public catalog sections.
- Radius tokens: badges `--radius-sm: 8px`, controls `--radius-md: 12px`, book cards `--radius-lg: 14px`, category tiles `--radius-tile: 16px`, major sections `--radius-xl: 20px`, and `--radius-pill: 999px` for intentionally circular controls only.
- Card border: `1px solid var(--border-soft)`; stronger controls and menus use `--border-strong`.
- Default card shadow: `0 4px 14px rgba(15, 23, 42, 0.05)`. Hover/focus depth is `0 8px 24px rgba(15, 23, 42, 0.08)`.
- Hover movement is limited to a subtle 2px lift. Respect `prefers-reduced-motion` and never make motion necessary to understand an action.

## Components

### Buttons, inputs, and forms

- Primary buttons are NAWA Navy with white text and one clear action per local area. Hover uses `--nawa-navy-hover`.
- Quiet buttons use a white surface, border, and dark readable text. Coral is a secondary/accent action; destructive actions retain explicit destructive semantics.
- Every control has a minimum 40px touch target, a visible focus ring, a clear text label, disabled styling, and an explicit loading label where needed.
- Inputs use a white background, subtle border, 10–12px radius, persistent or screen-reader-visible labels, and plain inline validation feedback.
- Keep forms short and grouped. Preserve entered values after recoverable errors.

### Shared public header

- The header uses a white surface, thin bottom border, and very light shadow.
- It contains the Delta University logo/wordmark, a slim utility layer, real catalog search, university-library navigation, language switch, sign-in/account state, and only functional role destinations available to the signed-in role.
- The public header uses the two-layer reference rhythm on desktop. It condenses into a keyboard-operable menu and full-width search on small screens without retaining crowded desktop-only utility items.
- Active navigation uses Navy text plus a soft shape and a small Coral underline, never color alone.
- The desktop header remains compact. On tablet and mobile it becomes a native-button-controlled menu with `aria-expanded`, a labelled navigation region, 44px touch controls, and Escape-to-close behavior.
- Do not use dark navigation. Do not show inaccessible role destinations.

### Category tiles

- Categories come from the real category API and filter the real full catalog query.
- Tiles use Navy-soft, Cream, Coral-soft, Gold-soft, and restrained legacy pastels for differentiation, a short localized name, and a clear pressed state. Gold and Coral remain sparse.
- The selected state uses `aria-pressed`, a Navy boundary or Coral underline, and a light focus shape.
- Tiles scroll horizontally on narrow screens using inline-axis snapping and a styled thin scrollbar. The interaction and order must remain usable in LTR and RTL.
- Provide an “All books” option, a skeleton loading state, and a plain no-categories message.

### Book cards

- Reuse the shared `BookCard` for the full catalog grid and the compact `BookShelfCard` for homepage shelves. They share cover, localization, author, availability, border, focus, and action conventions while using layouts appropriate to their context.
- Each card shows the real cover or a clean no-cover placeholder, localized title, localized author names, category, available/total copy summary, and a named details action.
- Availability is expressed with text and a non-color dot. “Available” and “Currently unavailable” must remain distinguishable without color.
- Cards expose a readable accessible name containing the book title and availability. Cover images have useful alternative text; decorative placeholders retain an explicit no-cover label.
- Use a white surface, soft border, 14px radius, restrained default and hover depth, and a responsive one-to-four-column grid. Do not crowd descriptions or administration metadata into public cards.

### Cards, tables, filters, and navigation

- General cards group meaningful content rather than every datum. Tables prioritize aligned columns, readable headers, row dividers, and responsive overflow or compact rows.
- Public catalog filters are limited to capabilities supported by the API: text search, category, available-only, language, supported sort values, and pagination.
- Show text-labelled removable active-filter chips and a reset action only when filters are active. Filter changes reset pagination to page one.
- The filter bar remains visible on desktop and is controlled by a named, `aria-expanded` toggle on mobile.
- Primary navigation remains short and role-aware. Staff and member page redesigns must be handled by their designated UI Refresh parts rather than indirectly through public catalog work.

### Member circulation area

- Member circulation is a book-activity experience, not a staff dashboard. My Loans and My Reservations share a compact local navigation, book cover/fallback language, calm lifecycle badges, and the same warm white/cream Delta University Library surfaces.
- My Loans cards prioritize localized title and authors, due or returned date, effective server status, safe copy code, and one relevant action. Member identity, staff identity, barcodes, internal UUIDs, and unsupported fine language stay out of the member presentation.
- Renewal availability, denial reason, usage, and maximum come from the safe backend response. The interface must not recreate loan policy from dates or counts. Renewal requires a named keyboard-operable confirmation dialog and pending duplicate-submit protection.
- Keep the visual character of a polished Arabic knowledge retailer: compact merchandising rhythm, clear book imagery, strong navy hierarchy, restrained coral urgency, and small gold details where useful. This is inspiration only; do not copy another retailer's branding, assets, text, colors, or exact page composition. Delta University Library remains the visible identity and NAWA remains a quiet platform credit.

### Status badges and feedback states

- Status badges combine concise text with success, warning, error, information, or neutral color.
- Content-shaped skeletons are preferred for catalog loading; short actions may use a small spinner.
- Empty states explain what is absent and offer one relevant recovery action when possible.
- Errors use plain language, preserve filters/search input, and provide a working retry action without exposing technical details.
- Dialogs are reserved for focused or consequential tasks. Use native semantics, named confirm/cancel controls, focus management, and a clear consequence.

## Responsive behavior

- Build mobile-first and verify phone, tablet, and desktop widths.
- Public catalog grids use one column on narrow phones, two on larger phones, three on tablets, and four on wide desktop layouts.
- Search becomes stacked when necessary. Filters become a compact vertical group on narrow screens.
- Category browsing uses inline scrolling in both directions. Cards keep title, author, availability, and action readable at every width.
- No hover-only feature is allowed. Do not use sticky controls that obscure content.

## RTL and LTR behavior

- Set document `lang` and `dir` from the active language: Arabic is `rtl`, English is `ltr`.
- Use logical properties such as `margin-inline`, `padding-inline`, `inset-inline`, `border-inline`, and `text-align: start/end`. New code must not hardcode left/right when a logical equivalent exists.
- Mirror directional arrows, pagination affordances, mobile-menu placement, and layout flow. ISBNs, codes, dates, and numbers keep their naturally readable direction.
- Select localized book titles, category names, and author names with a safe fallback to the available language.
- Verify Arabic and English independently at desktop and mobile widths; a mechanical mirror is not sufficient.

## Accessibility rules

- Use semantic landmarks, ordered headings, native controls, explicit labels, useful image alternatives, and keyboard-operable interactions.
- Provide visible focus indicators with readable contrast. Meet WCAG-friendly contrast expectations for normal text and controls.
- Search has an accessible label; the language switch has clear visible text and explanatory title; category buttons expose names and pressed state; book-card actions include the target title.
- Mobile navigation is controlled by a named button, exposes expanded state, and closes with Escape.
- Announce async loading, result counts, errors, and empty results with appropriate live or status semantics. Avoid meaningless or redundant ARIA.
- Never rely on color, icons, animation, pointer hover, or visual position alone to communicate state.
