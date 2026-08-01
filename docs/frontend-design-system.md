# NAWA frontend design system — V2

## Purpose and visual direction

Design System V2 is the mandatory reference for all NAWA frontend work. The approved Arabic public homepage is the platform's visual North Star: a light, premium, welcoming bookstore and knowledge-marketplace character with an Arabic-first polished RTL presentation. Future public, member, librarian, and admin pages must feel like one product without copying the homepage layout into functional workspaces.

The customer-facing name is `NAWA`, Arabic `نَوَى`. Internal package, service, and database names remain unchanged unless a separate engineering task explicitly requires a rename. NAWA Navy leads the identity, Coral supplies the emotional accent, Gold is a rare premium detail, and Cream supplies warmth. Existing teal or unrelated legacy accents must not remain dominant in newly created or redesigned components. The experience must remain calm, easy to scan, and usable by students, librarians, administrators, older users, and people using small touch screens.

White and very light neutral surfaces are the default. Use compact, elegant spacing, clear hierarchy, familiar controls, thin borders, medium radii, refined cards, and restrained depth. Do not use dark navigation, pure-black backgrounds, crowded or dashboard-heavy public layouts, glassmorphism, neon or glowing effects, gaming or futuristic treatments, or decoration-first animation.

## Approved public-page composition

The public homepage follows this order: slim utility bar, main brand/navigation/search header, split hero with book imagery and message, real hero search, inline trust row, real category icon strip, `New releases`, `Most read`, and `Available now` book shelves, then the four-item service feature strip. `/books` preserves the same identity and adds the functional searchable, filterable, paginated full catalog. Do not display fake purchase or catalog controls; unsupported reference destinations may appear only as clearly non-interactive navigation text until their scheduled phase.

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

### Official NAWA North Star tokens

These tokens govern every newly created or redesigned surface. Existing semantic aliases may remain while a page is migrated, but new public work uses these values directly.

| CSS token               | Value     | Use                                             |
| ----------------------- | --------- | ----------------------------------------------- |
| `--nawa-navy`           | `#102F5E` | Wordmark, headings, navigation, primary actions |
| `--nawa-navy-hover`     | `#0C264C` | Navy hover and pressed state                    |
| `--nawa-navy-soft`      | `#EFF3F8` | Derived selected and icon background            |
| `--nawa-coral`          | `#E86A6A` | Active, new, featured, and emotional accents    |
| `--nawa-coral-hover`    | `#D95B5B` | Coral hover state                               |
| `--nawa-coral-dark`     | `#C84F55` | Accessible small coral text                     |
| `--nawa-coral-soft`     | `#FBEDEE` | Pale coral surface                              |
| `--nawa-gold`           | `#D9A441` | Rare premium, star, and achievement detail      |
| `--nawa-gold-dark`      | `#B9851D` | Deeper gold decorative detail                   |
| `--nawa-gold-soft`      | `#FBF3DE` | Pale premium surface                            |
| `--nawa-cream`          | `#FFF9F4` | Warm hero and promotional surface               |
| `--nawa-white`          | `#FFFFFF` | Main card and control surface                   |
| `--nawa-background`     | `#FAFBFD` | Page background                                 |
| `--nawa-text-primary`   | `#1F2F46` | Primary body text                               |
| `--nawa-text-secondary` | `#66758A` | Supporting copy and metadata                    |
| `--nawa-border`         | `#E7EBF1` | Thin structural border                          |

Semantic aliases are `--color-primary`, `--color-primary-hover`, `--color-accent`, `--color-premium`, `--color-page-background`, `--color-surface`, `--color-warm-surface`, `--color-text`, `--color-text-muted`, and `--color-border`. Use them instead of repeating raw values.

Colored interface emphasis follows approximately 70% navy, 20% coral, and 10% gold. This ratio does not include white, cream, or neutral page area. Coral never becomes the main page background; Gold never becomes a primary button, body-text, or dominant background color. Status meaning always includes readable text or an icon rather than relying on color.

### Logo system

The approved full-color logo is `apps/frontend/public/brand/nawa-logo.png`. The repository also carries `nawa-logo-navy.png`, `nawa-logo-white.png`, and `nawa-logo-black.png` for reduced-color, dark-surface, and mandatory monochrome uses. `nawa-logo-mask.png` is the preserved transparent geometry source used to produce those deterministic flat-color assets, not a direct UI asset. Preserve the supplied geometry, English and Arabic wordmarks, clear space, and aspect ratio. Do not recreate the mark with CSS, stretch it, add effects, or recolor it ad hoc.

The primary official logo must not introduce gradients. Main symbol and wordmark weight remains navy, Coral is the distinctive secondary detail, and Gold is limited to a very small premium detail. Use the full-color or navy logo on white/cream, the white version on navy, and black only where production constraints require it.

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

Gradients are optional and limited to subtle large decorative areas such as a hero or no-cover placeholder. Approved public heroes blend navy-soft, cream, and coral-soft without making Coral dominant. Gradients are forbidden in the primary official logo and must not appear on routine buttons, inputs, tables, navigation, status badges, or every card. Never use glowing, high-saturation, animated, or multi-layer decorative gradients.

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
- It contains the NAWA/نَوَى brand, a slim utility layer, real catalog search, public navigation, language switch, sign-in/account state, and only functional role destinations available to the signed-in role.
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
