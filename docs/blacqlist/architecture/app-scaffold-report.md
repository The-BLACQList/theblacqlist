# App Scaffold Report — The BLACQList

**Date:** 2026-05-07
**Ticket:** 001 — Next.js project initialization and tooling
**Status:** Complete

---

## 1. Scaffold Command

```bash
pnpm create next-app@latest . --typescript --tailwind --app --no-src-dir --eslint --import-alias "@/*"
```

**Note:** pnpm blocked `sharp` and `unrs-resolver` build scripts by default. Resolved by adding to `package.json`:

```json
"pnpm": {
  "trustedDependencies": ["sharp", "unrs-resolver"]
}
```

---

## 2. Installed Versions

| Package | Version |
|---|---|
| Next.js | 16.2.5 |
| React | 19.2.4 |
| TypeScript | 5.9.3 |
| Tailwind CSS | 4.2.4 |
| ESLint | 9.39.4 |
| clsx | 2.1.1 |
| tailwind-merge | 3.5.0 |

**Note:** Tailwind v4 was installed. There is no `tailwind.config.ts` — brand tokens are configured via `@theme` in `globals.css` (the v4 approach).

---

## 3. Files Created or Modified

| File | Action | Notes |
|---|---|---|
| `app/globals.css` | Modified | Tailwind v4 `@theme` block with brand tokens; replaced default Geist/dark-mode styles |
| `app/layout.tsx` | Modified | Lato + Quicksand Google Fonts; BLACQList metadata; removed Geist fonts |
| `app/page.tsx` | Modified | Placeholder homepage with three-line content |
| `tsconfig.json` | Modified | Added `noUncheckedIndexedAccess: true` (strict was already enabled) |
| `next.config.ts` | Modified | Added `experimental.typedRoutes: true` |
| `.gitignore` | Modified | Replaced `.env*` glob with explicit exclusions; `.env.example` is now committed |
| `package.json` | Modified | Added `clsx`, `tailwind-merge`; added `pnpm.trustedDependencies` |
| `lib/utils.ts` | Created | `cn()` helper using clsx + tailwind-merge (required by shadcn/ui) |
| `types/index.ts` | Created | Barrel export file (empty placeholder) |
| `.env.example` | Created | All env var groups A–G; safe to commit |
| `.env.local` | Created | Local placeholder values; gitignored |
| `components/ui/.gitkeep` | Created | Reserves shadcn/ui component directory |
| `public/fonts/glacial-indifference/.gitkeep` | Created | Reserves Glacial Indifference font directory |

**Deleted (default Next.js placeholders):**
- `public/vercel.svg`
- `public/next.svg`
- `public/file.svg`
- `public/globe.svg`
- `public/window.svg`

---

## 4. Project Structure

```
theblacqlist/
├── app/
│   ├── favicon.ico
│   ├── globals.css          ← Tailwind v4 + brand tokens
│   ├── layout.tsx           ← Lato + Quicksand fonts; metadata
│   └── page.tsx             ← Placeholder homepage
├── components/
│   └── ui/                  ← shadcn/ui components (populated in Ticket 015)
├── docs/                    ← All planning artifacts (pre-existing)
├── lib/
│   └── utils.ts             ← cn() helper
├── public/
│   ├── favicon.ico
│   └── fonts/
│       └── glacial-indifference/  ← Font files go here (see Section 6)
├── types/
│   └── index.ts             ← Shared type exports
├── .env.example             ← Committed; all var names with empty values
├── .env.local               ← Gitignored; local placeholder values
├── .gitignore
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── postcss.config.mjs
└── tsconfig.json
```

---

## 5. Configuration Details

### TypeScript (`tsconfig.json`)

- `"strict": true` — enabled by default from create-next-app
- `"noUncheckedIndexedAccess": true` — added; array/object index access returns `T | undefined`
- `@/*` path alias points to the project root

### Tailwind Brand Tokens (`globals.css`)

Tailwind v4 brand tokens defined in `@theme`:

| Token | Class | Value |
|---|---|---|
| `--color-brand-black` | `bg-brand-black`, `text-brand-black` | `#000000` |
| `--color-deep-bg` | `bg-deep-bg`, `text-deep-bg` | `#19191E` |
| `--color-charcoal` | `bg-charcoal`, `text-charcoal` | `#595758` |
| `--color-amber-gold` | `bg-amber-gold`, `text-amber-gold` | `#E2A428` |
| `--color-light-gold` | `bg-light-gold`, `text-light-gold` | `#FFD867` |
| `--color-pale-lavender` | `bg-pale-lavender`, `text-pale-lavender` | `#E9E9F7` |
| `--color-cream` | `bg-cream`, `text-cream` | `#FCFAF4` |

Font family tokens:

| Token | Class | Loaded via |
|---|---|---|
| `--font-headline` | `font-headline` | `var(--font-glacial)` → self-hosted (see Section 6) |
| `--font-subhead` | `font-subhead` | `var(--font-lato)` → `next/font/google` |
| `--font-body` | `font-body` | `var(--font-quicksand)` → `next/font/google` |

### Google Fonts

Loaded in `app/layout.tsx` via `next/font/google`:
- **Lato** — weights 400, 700 — `variable: "--font-lato"`
- **Quicksand** — weights 400, 700 — `variable: "--font-quicksand"`

---

## 6. Glacial Indifference Font Setup (Required Before Ticket 015)

Glacial Indifference Bold is not available on Google Fonts. It must be self-hosted.

**Action required:**
1. Download `GlacialIndifference-Bold.otf` from [fonts.cdnfonts.com/s/13814/GlacialIndifference-Bold.woff](https://www.cdnfonts.com/glacial-indifference.font) or another trusted source.
2. Place the file at: `public/fonts/glacial-indifference/GlacialIndifference-Bold.otf`
3. Update `app/layout.tsx` to load the font via `next/font/local`:

```typescript
import localFont from "next/font/local"

const glacialIndifference = localFont({
  src: "../public/fonts/glacial-indifference/GlacialIndifference-Bold.otf",
  variable: "--font-glacial",
  weight: "700",
  display: "swap",
})
```

4. Add `glacialIndifference.variable` to the `<html>` className in `layout.tsx`.
5. Remove the `:root { --font-glacial: sans-serif; }` fallback in `globals.css`.

**Current state:** `--font-glacial` falls back to `sans-serif` until the font file is added. Headlines will render with a system sans-serif font in the meantime. All other layout and color behavior is correct.

---

## 7. Placeholder Homepage

`app/page.tsx` renders exactly:

```
The BLACQList
Atlanta-born. National from day one.
Find & Be Found.
```

No real features are implemented. This file is replaced in Ticket 015 (app shell build-out).

---

## 8. Verification Results

| Check | Result |
|---|---|
| `pnpm tsc --noEmit` | ✓ Zero errors |
| `pnpm lint` | ✓ Zero errors |
| `pnpm dev` | Not run (dev server test — run manually to verify) |

---

## 9. Environment Variables

All vars documented in `.env.example`. Full details in `architecture/environment-plan.md`.

Groups:
- **A** — Supabase public (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- **B** — Supabase server-only (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`)
- **C** — App config (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_ENV`)
- **D** — Email (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`)
- **E** — Sentry (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`)
- **F** — Anthropic AI (`ANTHROPIC_API_KEY`, `NEXT_PUBLIC_AI_FEATURES_ENABLED`)
- **G** — Stripe (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)

---

## 10. Next Step

**Ticket 002:** Supabase project setup and environment configuration
- Install Supabase CLI
- Run `supabase init` to create `supabase/` directory
- Define local vs staging vs production Supabase project setup
- Populate `.env.local` with values from `supabase start` output
