# Smart Library frontend design system

## Purpose and visual direction

This is the mandatory design system for all Smart Library frontend work. It serves students, librarians, administrators, older users, and mobile users with a light, calm, welcoming interface. Prefer clear content, comfortable spacing, and familiar patterns over decoration.

The primary visual style is light: use white and soft off-white backgrounds, calm blue and teal accents, subtle borders, moderate radii, and restrained shadows. Do not use dark navigation or pure-black backgrounds as defaults. Avoid futuristic, neon, gaming, crowded, glassmorphism, glow-heavy, or gradient-heavy treatments.

## Color tokens

| Token                   | Value     | Use                                                |
| ----------------------- | --------- | -------------------------------------------------- |
| `color-primary`         | `#2563EB` | Primary actions, selected controls, links          |
| `color-primary-light`   | `#DBEAFE` | Selected or informational backgrounds              |
| `color-secondary`       | `#0D9488` | Secondary emphasis and positive supporting actions |
| `color-secondary-light` | `#CCFBF1` | Secondary highlights                               |
| `color-background`      | `#F8FAFC` | Page background                                    |
| `color-surface`         | `#FFFFFF` | Cards, dialogs, inputs, tables                     |
| `color-text-primary`    | `#0F172A` | Headings and body text                             |
| `color-text-secondary`  | `#64748B` | Supporting text and metadata                       |
| `color-border`          | `#E2E8F0` | Dividers and input/card borders                    |
| `color-success`         | `#16A34A` | Success states                                     |
| `color-warning`         | `#F59E0B` | Warnings and pending states                        |
| `color-error`           | `#DC2626` | Errors and destructive actions                     |

Use semantic tokens rather than raw values in components. Never rely on color alone to communicate status.

## Typography and spacing

- Use a readable sans-serif stack with Arabic glyph support. Body text is normally 16px with a 1.5–1.6 line height; do not use body text below 14px.
- Use a compact hierarchy: page title 30–36px, section title 20–24px, card title 16–18px, and metadata 14px. Use weight and spacing before adding color.
- Spacing scale: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64px`. Prefer 16–24px within cards and 24–40px between page sections.
- Maintain generous whitespace. A dense data table may reduce internal spacing on small screens, but must remain readable and touch-friendly.

## Shape, borders, and shadows

- Radius: 6px for inputs/badges, 8px for buttons, 12px for cards/dialogs. Do not use pill shapes except compact tags or status badges.
- Use `#E2E8F0` 1px borders for inputs, cards, table rows, and structural separation.
- Shadows are optional and very light: one low-elevation shadow for dialogs/popovers and a subtle shadow for elevated cards. Do not stack shadows or add glow effects.

## Components

### Buttons

- Primary buttons are blue with white text; use them for one main action in a local area.
- Secondary buttons use a white surface and border or a pale blue background. Destructive actions use red only when the action is destructive.
- Include clear labels, a 40px minimum touch target, disabled styling, keyboard focus, and a concise loading label/spinner. Do not create icon-only buttons without an accessible name.

### Inputs and forms

- Inputs use white backgrounds, subtle borders, 8px radius, visible labels, helpful hint text where needed, and clear inline validation messages.
- Group related fields in short sections. Progressive disclosure is preferred over showing every optional setting at once.
- Required fields, errors, and success feedback must be announced accessibly. Preserve entered values after recoverable validation failures.

### Cards, tables, and filters

- Cards have a white surface, thin border, 12px radius, and 16–24px padding. Use cards to group meaningful content, not every individual datum.
- Tables prioritize scanability: clear headers, aligned columns, row dividers, responsive overflow or a compact card representation on narrow screens, and accessible row actions.
- Filters default to the most useful controls. Put less-common filters behind an explicit “More filters” control. Show active filters as removable text-labeled chips.

### Navigation

- Navigation has a white or soft off-white surface, visible active state using blue plus shape/text emphasis, and no dark default treatment.
- Keep primary navigation short. Put role-specific entries behind role-aware navigation; do not show inaccessible destinations.
- Mobile navigation uses a simple accessible menu with focus management and a clear close action.

### Status badges

- Use concise text labels plus color: success green, warning amber, error red, information blue, and neutral gray/secondary text.
- Status badges use light tinted backgrounds, dark readable text, 6px radius, and never rely on an icon or color alone.

## Feedback patterns

- Empty states explain what is absent, why it matters, and offer one relevant action only when that action is available.
- Loading states use skeletons for content-shaped loading and a small spinner for short actions. Avoid full-page blockers when part of the page can remain usable.
- Error states use plain language, preserve user input, identify a safe recovery action, and avoid exposing technical details.
- Use modals only for focused tasks or consequential confirmations. A confirmation must state the consequence, primary action, cancel action, and destructive styling when relevant. Focus stays within an open modal and returns to its trigger on close.

## Mobile behavior

- Build mobile-first. Ensure a minimum 40px touch target, single-column forms where appropriate, readable tables through horizontal scroll or transformed rows, and no hover-only behavior.
- Keep key actions visible, but avoid sticky controls that obscure content. Test common narrow widths before introducing multi-column layouts.

## RTL and LTR behavior

- Set document `dir` and language from the selected language. Use logical CSS properties (`margin-inline`, `padding-inline`, `inset-inline`, `text-align: start/end`) instead of left/right-specific layout rules.
- Mirror directional layout, icons, pagination controls, drawers, and table alignment appropriately in Arabic. Numbers, dates, ISBNs, and codes retain their natural readable direction.
- Verify English LTR and Arabic RTL layouts independently; a mechanically mirrored layout is not sufficient.

## Accessibility rules

- Use semantic landmarks, headings in order, native controls where possible, explicit labels, alternative text, and keyboard-operable interactions.
- Provide visible focus indicators with sufficient contrast. Meet WCAG-friendly contrast expectations for text and controls.
- Announce async status, validation, loading completion, and errors through appropriate screen-reader-friendly messages.
- Respect reduced-motion preferences. Animations, when useful, are brief and never the only indication of state.
