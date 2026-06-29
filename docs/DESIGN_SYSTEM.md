> Part of the `institute_website` documentation set — see [README.md](README.md).
> Curated conceptual view; the authoritative per-folder contracts live in each
> folder's `AGENTS.md`. The `docs/` folder is **not** built into the site.

# Institute Website: Design System & Documentation Guide

**Version:** 2.6.0 | **Last Updated:** 2026-06-28

This guide documents the Active Inference Institute website's design system, styling conventions, and provides a complete inventory of existing documentation. The site is a static GitHub Pages build with strict content-security-policy constraints and a unified design-system token contract.

---

## Design System Overview

The website's visual language is controlled by a small, canonical token contract that ensures brand consistency and provides a single source of truth for color, typography, spacing, and motion. The design system is framework-free and self-hosted.

### Design-System Token Architecture

#### CSS Layering

All pages link **two stylesheets in strict order:**

1. **`assets/css/instituteos-ds.css`** (Generated, byte-pinned)
   - The canonical design-system token export from `@instituteos/design-system`
   - Defines all `--ds-*` custom properties for brand, surfaces, text, spacing, radius, shadows, and motion
   - Includes complete light-theme token overrides keyed on `html.theme-light`
   - **Never hand-edit.** Regenerate via `npm run check:design-system` when upstream tokens change
   - Self-hosts four web fonts (Inter Tight, Fraunces, JetBrains Mono) as woff2

2. **`assets/css/styles.css`** (Authored site layer)
   - Consumes `--ds-*` tokens and provides local aliases with fallbacks
   - Defines page layout, components, navigation, cards, and responsive behavior
   - Maps tokens to short names for readability (`--ink`, `--paper`, `--surface`, `--red`, etc.)
   - Every fallback value equals the canonical dark-theme token value, enforced by `check:design-system`

3. **`assets/css/graphs.css`** (Additional, self-contained)
   - Styles for the graph/visualization components (node-link diagrams)
   - No cross-dependencies with the main stylesheet

#### Token Fallback Contract

The site implements a defensive fallback strategy. Every `var(--ds-*, <fallback>)` reference in `styles.css` **must have a fallback equal to the canonical dark-theme value:**

```css
:root {
  --ink:       var(--ds-text, #e5e5e5);        /* fallback = dark token */
  --paper:     var(--ds-bg, #0a0a0a);         /* fallback = dark token */
  --surface:   var(--ds-surface, #151515);    /* fallback = dark token */
  --red:       var(--ds-red, #dc2626);        /* fallback = dark token */
  --accent-text: var(--ds-red-light, #ef4444); /* fallback = dark token */
}
```

If `instituteos-ds.css` ever fails to load, the site remains styled and on-brand using dark fallbacks. The build gate (`check:design-system`) verifies this invariant automatically, so fallbacks never silently drift from the source of truth.

### Brand & Color System

#### Primary Palette

- **Brand Red** — the sole accent color across the site
  - `--ds-red: #dc2626` (canonical brand red)
  - `--ds-red-light: #ef4444` (lighter variant, used for link text on dark backgrounds)
  - `--ds-red-dark: #b91c1c` (darker variant for hover states)

- **On-Accent** — white text that sits on red backgrounds in both themes
  - `--ds-on-accent: #ffffff` (intentionally white in both light and dark)

#### Semantic Colors (Supporting, not accent)

- `--ds-success: #22c55e`
- `--ds-warning: #f59e0b`
- `--ds-danger: #ef4444`
- `--ds-info: #06b6d4`

These are defined in the design system but are **not currently used** on the public website (accent is reserved for red). They exist for future expansion or dashboard integration.

#### Surface & Text (Dark Theme, Default)

- **Backgrounds**
  - `--ds-bg: #0a0a0a` — near-black page background
  - `--ds-surface: #151515` — raised card/container surfaces
  - `--ds-surface-2: #2a2a2a` — stronger elevated surfaces
  - `--ds-glass: rgba(21, 21, 21, 0.85)` — translucent overlay surfaces
  
- **Text**
  - `--ds-text: #e5e5e5` — primary body text, white-ish
  - `--ds-text-muted: #999999` — secondary/meta text, medium gray
  - `--ds-text-dim: #808080` — tertiary/disabled text, darker gray

- **Borders & Lines**
  - `--ds-glass-border: rgba(255, 255, 255, 0.08)` — subtle lines, used for dividers
  - `--ds-border: var(--ds-glass-border)` — semantic alias

- **Shadows**
  - `--ds-shadow: 0 8px 32px rgba(0,0,0,0.5)` — standard elevation shadow
  - `--ds-shadow-sm: 0 1px 2px rgba(0,0,0,0.25)` — subtle/semantic shadows
  - `--ds-shadow-lg: 0 2px 4px rgba(0,0,0,0.15), 0 12px 32px -8px rgba(0,0,0,0.55), 0 24px 48px -16px rgba(220,38,38,0.06)` — strong/feature shadows

#### Light-Theme Overrides (`html.theme-light` or `.ds-theme-light`)

When the user toggles light mode (via `assets/js/theme.js`), a `theme-light` class is added to `<html>`. The design-system CSS includes a complete `html.theme-light` block that re-tints all surfaces and text:

```css
html.theme-light {
  --ds-bg: #f9fafb;                    /* light beige background */
  --ds-surface: #ffffff;               /* white cards */
  --ds-surface-2: #f3f4f6;             /* very light gray elevated surfaces */
  --ds-text: #111827;                  /* near-black text */
  --ds-text-muted: #4b5563;            /* medium gray meta text */
  --ds-text-dim: #6b7280;              /* lighter gray for disabled */
  --ds-glass: rgba(255, 255, 255, 0.85);
  --ds-glass-border: rgba(0, 0, 0, 0.08);
  /* Shadows soften for light backgrounds */
  --ds-shadow: 0 4px 16px rgba(0,0,0,0.1);
  --ds-shadow-lg: 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -4px rgba(0,0,0,0.12), 0 24px 48px -16px rgba(220,38,38,0.08);
}
```

**Theme-Aware Text Color Rules:**
- Link text (`--accent-text`) **flips per theme** to maintain WCAG AA contrast:
  - Dark mode: `#ef4444` (light red) on `#0a0a0a` ≈ 5.8:1 contrast
  - Light mode: `#dc2626` (brand red) on `#f9fafb` ≈ 5:1 contrast
  
The override lives in `styles.css` root:
```css
html.theme-light {
  --accent-text: var(--ds-red, #dc2626);
}
```

### Typography

#### Font Families (Self-Hosted)

All fonts are self-hosted as woff2, subset to Latin, with `font-display: swap` for fast text rendering.

- **Display/Serif** — `'Fraunces'`, fallback Georgia
  - Used for page titles (H1), major headings
  - Weights: 400, 600
  
- **Body/Sans** — `'Inter Tight'`, fallback system sans-serif
  - Used for body copy, labels, UI text
  - Weights: 400, 500, 600, 700
  
- **Mono** — `'JetBrains Mono'`, fallback SF Mono/Menlo
  - Used for code, technical labels, metadata
  - Weights: 400, 600

#### Type Scale

Defined as CSS custom properties, all relative to a 16px base (`1rem`):

| Token | Size | Use |
|-------|------|-----|
| `--ds-text-xs` | 0.75rem (12px) | tiny labels, badges |
| `--ds-text-sm` | 0.875rem (14px) | small text, captions, secondary labels |
| `--ds-text-base` | 1rem (16px) | body copy default |
| `--ds-text-lg` | 1.125rem (18px) | card titles, section leads |
| `--ds-text-xl` | 1.375rem (22px) | subheadings |
| `--ds-text-2xl` | 1.75rem (28px) | page subtitle |
| `--ds-text-3xl` | 2.25rem (36px) | section headings |
| `--ds-text-4xl` | 3rem (48px) | page H1 |

#### Font Weights

- `--ds-weight-normal: 400`
- `--ds-weight-medium: 500`
- `--ds-weight-semibold: 600`
- `--ds-weight-bold: 700`

#### Line Heights

- `--ds-leading-tight: 1.15` — compact, for titles
- `--ds-leading-snug: 1.35` — reduced, for subheads
- `--ds-leading-normal: 1.6` — readable, for body copy

### Spacing

A consistent 4px base unit (`--ds-space-1 = 0.25rem`), scaling to 4rem:

| Token | Value | Use |
|-------|-------|-----|
| `--ds-space-1` | 0.25rem (4px) | padding inside tiny components |
| `--ds-space-2` | 0.5rem (8px) | component padding |
| `--ds-space-3` | 0.75rem (12px) | element gaps |
| `--ds-space-4` | 1rem (16px) | default padding/margin |
| `--ds-space-5` | 1.5rem (24px) | section spacing |
| `--ds-space-6` | 2rem (32px) | major spacing |
| `--ds-space-7` | 3rem (48px) | large page sections |
| `--ds-space-8` | 4rem (64px) | hero/feature spacing |

### Radius

- `--ds-radius-sm: 10px` — small components (buttons, badges)
- `--ds-radius: 16px` — standard radius (cards, containers)
- `--ds-radius-pill: 999px` — fully rounded (pills, avatars)

### Shadow & Depth

- `--ds-shadow` — standard elevation, used most
- `--ds-shadow-sm` — subtle, for nested/secondary elements
- `--ds-shadow-lg` — strong, for prominent modals/hero sections
- `--ds-blur-glass: 12px` — blur radius for translucent backgrounds

### Motion & Transitions

All animations use cubic-bezier easing for consistency:

- `--ds-motion-fast: 120ms` — quick state changes (hover, focus)
- `--ds: 200ms` — default transition speed
- `--ds-motion-slow: 320ms` — significant layout shifts, modals
- `--ds-ease: cubic-bezier(0.4, 0, 0.2, 1)` — "material" easing curve

**Reduced-Motion Support:** The site honors `prefers-reduced-motion: reduce` by disabling all transitions and animations for users who opt out:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Accessibility Features

#### Color Contrast

The site enforces WCAG AA (4.5:1 minimum) across both light and dark themes:
- Dark mode: white text (`#e5e5e5`) on near-black (`#0a0a0a`) ≈ 11:1
- Light mode: near-black text (`#111827`) on light backgrounds ≈ 16:1
- Link text flips per theme (see **Theme-Aware Text** above) to maintain minimum 4.5:1

#### Focus States

All interactive elements support keyboard navigation:
- Focus outline: `2px solid var(--red)` with `3px offset`
- Dropdown menus: `aria-expanded` state synced to focus
- Hover and focus states must be distinct and non-hover-only

#### Semantic Structure

The site uses proper HTML landmarks:
- `<header>` with sticky positioning and scroll-aware shadowing
- `<main>` containing page content
- `<nav>` for navigation with `aria-label` and `aria-expanded` for disclosure
- Semantic heading hierarchy (H1–H6, no skipping levels)
- `<section>` for major content blocks
- `alt` text on all images (enforced by `check:security`)

#### Motion & Animation

- Avoid infinite loops or rapid flickering (all animations are finite, paced)
- `prefers-reduced-motion: reduce` completely disables animations
- No auto-playing videos or audio
- Smooth scroll on `<html>` is disabled for reduced-motion users

---

## Existing Documentation Inventory

This section maps all current documentation and where it lives, so you can understand the landscape before consolidating into a new `docs/` folder.

### Root-Level Documentation (9 files)

| File | Purpose | Audience | Key Topics |
|------|---------|----------|------------|
| **README.md** | Human-facing overview | General/new contributors | Purpose, architecture, build model, content model, deployment, design contract |
| **AGENTS.md** | Agent guide (documentation map) | Claude Code, agents, developers | Operating contract, build model, verification gates, deployment checklist |
| **DESIGN_SYSTEM.md** | Design-system token reference | Developers, designers | CSS layering, token fallback contract, theming, gate enforcement |
| **CONTRIBUTING.md** | Contribution guidelines | External contributors | How to report issues, submit PRs, code of conduct |
| **CHANGELOG.md** | Version history | Release coordinators, auditors | All shipped features v1.0–v2.6, breaking changes, internal refactors |
| **TODO.md** | Roadmap & backlog | Developers, coordinators | Shipped milestones, backlog ideas, conventions |
| **INTERNATIONALIZATION.md** | i18n architecture | Developers, translators | Why build-time translation, how the system works, catalog management, workflows |
| **MIGRATION.md** | Squarespace → GitHub Pages | DevOps, deployment | Redirect map, subdomain-forward table (mentioned but not detailed in read) |
| **SWITCHOVER.md** | Cutover handoff & checklist | DevOps, release lead | Done/can-do/needs-human tasks, DNS records (mentioned but not detailed in read) |

### Per-Folder Agent Guides (7 AGENTS.md files)

These are **essential operational guides** organized by folder. They document implementation patterns, constraints, and gate contracts specific to each subsystem.

| File | Folder | Purpose | Key Content |
|------|--------|---------|------------|
| **src/AGENTS.md** | `src/` | Build pipeline architecture | Entry point, data loading, URL taxonomy, subdirectory map, verification gates |
| **src/render/AGENTS.md** | `src/render/` | HTML rendering & templates | `layout()` contract, link resolution, SEO/security/URLs, module map |
| **src/lib/AGENTS.md** | `src/lib/` | Helper utilities | File output, path helpers, text utilities, data access, resource handling |
| **src/content/AGENTS.md** | `src/content/` | Content registries | Link contract, registry reference, instituteos/ sync, i18n catalogs, constraints |
| **src/content/pages/AGENTS.md** | `src/content/pages/` | Page authoring | Folder groupings, page schema, slug taxonomy, link rules, gates |
| **scripts/AGENTS.md** | `scripts/` | Build tooling & gates | npm scripts, check gates, sync script, link verification, translation |
| **assets/AGENTS.md** | `assets/` | Static assets | CSS structure, JavaScript modules, images |

### Specialized Documentation

| File | Topic | Format |
|------|-------|--------|
| **src/content/pages/_TEMPLATES.md** | Page authoring templates | JSON skeleton + examples |
| **src/content/instituteos/README.md** | Open Source Map data schemas | Per-file schema reference |
| **.claude/skills/institute-website/SKILL.md** | Agent skill definition | Golden rules, task workflows |
| **.claude/skills/institute-website/Workflows/AddOrEditPage.md** | Content page workflow | Step-by-step add/edit procedure |

### Documentation by Topic

#### Architecture & Build Model
- **README.md** — High-level purpose, public content policy, architecture diagram, local workflow, deployment
- **src/AGENTS.md** — Build pipeline, entry point, data loading, URL taxonomy
- **src/render/AGENTS.md** — HTML rendering, layout contract, link resolution
- **src/lib/AGENTS.md** — Utility modules and constraints

#### Content & Authoring
- **src/content/AGENTS.md** — Registries, link contract, content model
- **src/content/pages/AGENTS.md** — Page schema, slug taxonomy, authoring rules
- **src/content/pages/_TEMPLATES.md** — JSON templates and examples
- **README.md** — Content model overview

#### Design & Styling
- **DESIGN_SYSTEM.md** — Token architecture, theming, fallback contract, gate enforcement
- **assets/AGENTS.md** — CSS structure, font hosting, JavaScript modules
- **assets/css/instituteos-ds.css** — Design-token definitions (generated, not documentation)
- **assets/css/styles.css** — Site CSS and component layer

#### Gates & Verification
- **scripts/AGENTS.md** — All check gates, npm scripts, link verification
- **AGENTS.md** — Verification gates checklist

#### Deployment & DevOps
- **README.md** — Deployment section, release gates checklist
- **AGENTS.md** — Deployment section, verification checklist
- **CHANGELOG.md** — Release notes and version history
- **MIGRATION.md** — Redirect/subdomain table (Squarespace migration)
- **SWITCHOVER.md** — Cutover checklist and DNS records

#### Internationalization
- **INTERNATIONALIZATION.md** — Full i18n architecture, workflow, file map
- **scripts/AGENTS.md** — `i18n:extract` and `i18n:translate` scripts
- **src/AGENTS.md** — Locale-aware routing and build loop

#### Code Quality & Contribution
- **CONTRIBUTING.md** — Issue reporting, PR process, code of conduct
- **TODO.md** — Conventions, roadmap
- **CHANGELOG.md** — Breaking changes and migration guidance

---

## Design Patterns & Style Conventions

### Component Conventions

#### Buttons & Interactive Elements
- **Primary Actions:** Red background (`--ds-red` / `--ds-primary`), white text (`--ds-on-accent`)
- **Secondary/Tertiary:** Transparent or surface backgrounds, text color = `--accent-text`
- **Hover/Focus:** Border appears (`--ds-glass-border`), background shifts to `--ds-surface`
- **Focus Outline:** `2px solid var(--red)` with `3px offset`

#### Cards & Containers
- **Background:** `--ds-surface` (raised surfaces) or `--ds-glass` (translucent overlays)
- **Borders:** `1px solid var(--line)` for subtle dividers
- **Radius:** `--ds-radius-sm` (10px) for small; `--ds-radius` (16px) standard
- **Shadow:** `--ds-shadow` for standard elevation
- **Padding:** Typically `--ds-space-4` to `--ds-space-6` depending on size

#### Text & Typography
- **Primary Text:** `--ink` (#e5e5e5 dark, #111827 light)
- **Secondary/Meta:** `--muted` (#999999 dark, #4b5563 light)
- **Links:** `--accent-text` (theme-aware, see above)
- **Headings:** Use Fraunces serif; pair with `--ds-weight-bold` or semibold
- **Body:** Use Inter Tight; line-height `1.55–1.6` for readability

#### Navigation & Disclosure
- **Dropdowns:** Click-activated with `aria-expanded`, keyboard-accessible
- **Focus States:** Visible outline, distinct from hover (not hover-only)
- **Mobile:** Disclosure dropdowns are flexible and stack properly

#### Forms (None Currently Used)
- The site has **no `<form>` elements** due to CSP (`form-action 'none'`).
- All interactive filtering/sorting is JavaScript-driven with client-side state.
- If forms are needed in the future, they cannot be added without relaxing the CSP.

### CSS Authoring Rules

1. **Always use design-system tokens.** Never hardcode colors or spacing.
   ```css
   /* Good */
   background: var(--surface);
   color: var(--ink);
   padding: var(--ds-space-4);
   
   /* Bad */
   background: #151515;
   color: #e5e5e5;
   padding: 1rem;
   ```

2. **Fallbacks must match dark-theme tokens.**
   ```css
   /* Good: fallback = canonical dark value */
   color: var(--ds-text, #e5e5e5);
   
   /* Bad: fallback doesn't match dark theme */
   color: var(--ds-text, #ffffff);
   ```

3. **Use relative units (rem, em) for sizing.** Never hardcoded px unless unavoidable (e.g., focus outlines, 1px borders).

4. **Prefer `clamp()` for responsive sizing.**
   ```css
   padding: clamp(1rem, 4vw, 3rem);
   ```

5. **Support reduced motion in animations.**
   ```css
   transition: opacity var(--ds-motion) var(--ds-ease);
   
   @media (prefers-reduced-motion: reduce) {
     * { transition-duration: 0.01ms !important; }
   }
   ```

6. **Keep light-mode in mind.** If a component uses `--ink` for text and `--paper` for background, it's automatically theme-aware. Don't hardcode near-black/near-white.

### JavaScript Conventions

All JavaScript is self-hosted (no external libraries) and CSP-compliant:

- **No inline handlers** (`onclick`, `oninput`, etc.) — use `addEventListener`
- **No inline styles** — use CSS classes or data attributes
- **No `fetch`** — data is baked into the HTML or accessed via DOM
- **Progressive enhancement** — JavaScript enhances existing DOM, doesn't create critical UI
- **Data attributes** — Use `data-*` to drive client-side behavior
  ```html
  <div data-sort="stars" data-filter="javascript"><!-- filtered by JS --></div>
  ```

### Image & Media Conventions

- **All images must have `alt` text** (enforced by `check:security`)
- **SVG glyphs:** Inline in render code (no separate `.svg` files for icons)
- **Self-hosted only:** No external image CDNs
- **Responsive images:** Use `width`/`height` attributes to prevent layout shift
- **Lazy loading:** `loading="lazy"` and `decoding="async"` for below-fold images
- **No auto-playing video/audio**

---

## Build & Release Gates

All changes must pass the offline gates before committing:

```bash
npm run build              # Render HTML
npm run check              # All gates (see below)
npm run check:links        # Internal link verification
npm run check:instituteos  # Public data freshness
npm run check:design-system # Token fallback enforcement
npm run check:site         # Content model & contract
npm run check:security     # CSP, anchor tags, forms
```

**Network gates (not part of `npm run check`):**
```bash
npm run check:sources      # Verify live-sources.json URLs (curl-based)
```

---

## How to Add New Design-System Features

If the upstream design system adds new tokens or changes:

1. **Regenerate the token export:**
   ```bash
   # Set INSTITUTEOS_DS_ROOT if not at ../library/design-system
   npm run check:design-system
   ```
   This will report if `instituteos-ds.css` is stale and can re-export it if the source is available.

2. **Update fallbacks in `styles.css`** if any new tokens are introduced:
   ```css
   --new-token: var(--ds-new-token, #fallback-dark-value);
   ```

3. **Add usage examples** in component code (e.g., `src/render/components.mjs`).

4. **Run `npm run check` to verify** the fallback contract.

5. **Update this guide** if the token is public-facing or changes a design principle.

---

## Version & Provenance

- **Current Version:** v2.6.0 (from `package.json`)
- **Export Fingerprint:** Recorded in `data/export-manifest.json` (public data snapshot)
- **Deploy:** Committed to `main` and served by GitHub Pages from the repo root
- **Design-System Source:** Upstream `@instituteos/design-system` (byte-pinned via `check:design-system`)

All generated artifacts (HTML, `robots.txt`, `sitemap.xml`, social cards, search index) are committed because GitHub Pages serves the repository root.

---

## Further Reading

- **Architecture & Build:** `README.md`, `src/AGENTS.md`
- **Design Tokens:** `DESIGN_SYSTEM.md`, `assets/css/instituteos-ds.css`
- **Content Authoring:** `src/content/pages/AGENTS.md`, `src/content/pages/_TEMPLATES.md`
- **Internationalization:** `INTERNATIONALIZATION.md`
- **Deployment & Gates:** `AGENTS.md`, `scripts/AGENTS.md`
- **Agent Skill:** `.claude/skills/institute-website/SKILL.md`
