# Ticket 001: Next.js 14 project initialization and tooling

## Status

Draft

## Phase

Phase 0: Setup and Foundation

## Priority

P0

## Feature Area

Infrastructure

## Context

Before any product feature can be built, the project must exist in a consistent, agreed-upon state. This ticket establishes the Next.js 14 application shell — the folder structure, TypeScript configuration, styling layer, and component library — that every subsequent ticket builds on top of. Without this ticket, no other ticket in Phase 0 or Phase 1 can begin. The tech stack decisions driving every choice here are documented in `docs/blacqlist/architecture/tech-stack-decision.md`.

## User Story

As an engineer joining the project, I want a fully configured Next.js 14 repository with TypeScript strict mode, Tailwind CSS, and shadcn/ui initialized to brand spec, so that I can start building product features immediately without spending time on setup decisions.

## Scope

- Initialize Next.js 14.x with the App Router (`app/` directory structure)
- Enable TypeScript strict mode in `tsconfig.json`
- Install and configure Tailwind CSS with brand color tokens and font variables
- Initialize shadcn/ui with theme customized to the BLACQList brand palette
- Create the standard project folder structure: `app/`, `components/`, `components/ui/`, `lib/`, `types/`, `public/`
- Add `lib/utils.ts` with the `cn()` helper using `clsx` and `tailwind-merge`
- Configure `next.config.ts` with baseline settings (image domains, strict mode)
- Create `.env.example` template with all required variable names from `environment-plan.md` (no real values)
- Add brand colors to `globals.css` as CSS custom properties and to `tailwind.config.ts` as `theme.extend.colors`
- Load fonts via `next/font`: Glacial Indifference Bold (headlines), Lato Regular (subheads), Quicksand Bold Italic (body/CTAs)
- Set shadcn/ui primary color to Amber Gold (`#E2A428`) and background to Deep Background (`#19191E`)

## Out of Scope

- Supabase client or database connection (Ticket 002)
- Authentication configuration (later ticket)
- Deployment pipeline or Vercel project creation (Ticket 003)
- Any product feature pages, components, or routes
- ESLint/Prettier/Husky configuration (Ticket 005)

## Dependencies

None — this is the first ticket in the project.

## UX Notes

N/A — infrastructure ticket. No user-facing screens are built here.

## Design Notes

Brand color tokens to define as CSS variables in `globals.css` and as `theme.extend.colors` in `tailwind.config.ts`:

| Token name      | Hex       | Usage                               |
| --------------- | --------- | ----------------------------------- |
| `brand-black`   | `#000000` | Primary text, backgrounds           |
| `deep-bg`       | `#19191E` | Page background, nav background     |
| `charcoal`      | `#595758` | Secondary text, borders             |
| `amber-gold`    | `#E2A428` | Primary CTAs, active states, badges |
| `light-gold`    | `#FFD867` | Hover states, highlights            |
| `pale-lavender` | `#E9E9F7` | Backgrounds, subtle accents         |
| `cream`         | `#FCFAF4` | Card backgrounds, light sections    |

shadcn/ui theme configuration:

- `--primary`: Amber Gold (`#E2A428`)
- `--background`: Deep Background (`#19191E`)
- `--foreground`: Cream (`#FCFAF4`)
- `--muted`: Charcoal (`#595758`)
- `--card`: `#1F1F25` (slightly lighter than deep-bg for card surfaces)

Fonts via `next/font/local` (self-hosted) or `next/font/google` where available. Font CSS variables: `--font-headline`, `--font-subhead`, `--font-body`.

## Data Notes

N/A — no database interaction in this ticket.

## API Notes

N/A — no API routes or Server Actions in this ticket.

## Implementation Notes

**Files to create:**

- `app/layout.tsx` — Root layout with font variables applied to `<html>`, global CSS import
- `app/globals.css` — CSS reset, CSS custom properties for brand tokens, Tailwind base directives
- `app/page.tsx` — Minimal placeholder home page (renders a single `<h1>` confirming the stack is working)
- `components/ui/` — Directory for shadcn/ui primitive components (populated by `npx shadcn-ui@latest init`)
- `lib/utils.ts` — `cn()` helper: `import { clsx } from 'clsx'; import { twMerge } from 'tailwind-merge'; export function cn(...inputs) { return twMerge(clsx(inputs)); }`
- `types/index.ts` — Empty barrel file; establishes the types directory
- `tailwind.config.ts` — Full Tailwind config with brand color extensions and font family extensions
- `next.config.ts` — Baseline Next.js config
- `.env.example` — All variable names from `environment-plan.md` Section 5 with placeholder values and description comments. All 50-state flags, image domains, etc. NO real values.
- `tsconfig.json` — `"strict": true`, `"noUncheckedIndexedAccess": true`, path aliases `@/*` mapping to `./src/*` or project root per Next.js convention

**Key patterns:**

- Use `pnpm` as the package manager (per `environment-plan.md`)
- Tailwind config uses `content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}']`
- shadcn/ui init command: `npx shadcn-ui@latest init` with style `default`, base color `neutral`, CSS variables enabled
- After shadcn/ui init, manually override `globals.css` CSS variables with BLACQList brand tokens
- Font loading: if Glacial Indifference is not on Google Fonts, use `next/font/local` with font files placed in `public/fonts/`. Lato is available via Google Fonts.
- `next.config.ts` must include: `experimental: { typedRoutes: true }` (for typed navigation) and image domain config for Supabase storage (placeholder — actual domain added in Ticket 002)

**Do not:**

- Add `src/` directory — use the project root `app/` convention
- Use `.js` or `.jsx` files — TypeScript only
- Add `@ts-ignore` anywhere
- Hardcode any colors in component files — use CSS variables or Tailwind tokens only
- Install `@emotion` or `styled-components` — Tailwind only for styling

## Acceptance Criteria

- [ ] `pnpm dev` starts the development server at `http://localhost:3000` without errors
- [ ] `tsc --noEmit` runs with zero TypeScript errors with strict mode enabled
- [ ] `npx tailwindcss --content './app/**/*.{ts,tsx}' --input globals.css` produces output referencing brand color tokens (Amber Gold `#E2A428` is present in the config)
- [ ] Visiting `http://localhost:3000` renders a page with no console errors or 404s
- [ ] shadcn/ui `Button` component with `variant="default"` renders with the Amber Gold background color (`#E2A428`) when imported into the placeholder home page
- [ ] `.env.example` exists in the repository root, contains all variables listed in `environment-plan.md` Section 5 Groups A–D, and contains no real values (only placeholders)
- [ ] Font variables (`--font-headline`, `--font-subhead`, `--font-body`) are defined in `globals.css` and applied via `app/layout.tsx`
- [ ] All required directories exist: `app/`, `components/ui/`, `lib/`, `types/`, `public/`
- [ ] `lib/utils.ts` exports a `cn()` function that correctly merges Tailwind classes
- [ ] No `.js` or `.jsx` files exist in `app/` or `components/`

## Failure States

| Failure                                                  | User-visible behavior                                                                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev` fails with missing dependency                 | Terminal shows an install error; engineer runs `pnpm install` to resolve                                                                                                                   |
| TypeScript strict mode breaks a shadcn/ui generated file | `tsc --noEmit` reports an error in `components/ui/`; engineer applies a type assertion or `// eslint-disable` with documented reason, noting it as a known shadcn/ui strict-mode edge case |
| Tailwind brand colors not applied                        | shadcn/ui Button renders with grey default; engineer verifies `tailwind.config.ts` content array includes the relevant file path                                                           |
| `.env.example` missing a required variable               | A downstream ticket fails because the engineer does not know a variable is needed; the fix is to add the missing variable to `.env.example` and update `environment-plan.md`               |
| Font files missing for self-hosted font                  | `next/font/local` throws at build time; engineer verifies font files are present in `public/fonts/`                                                                                        |

## Edge Cases

- Glacial Indifference is not available on Google Fonts — must use `next/font/local` with files in `public/fonts/`; document this in a code comment in `layout.tsx`
- shadcn/ui init may overwrite `globals.css` with its own variables — the brand token override must be applied after `shadcn-ui init` completes, not before
- `tsconfig.json` strict mode may conflict with initial shadcn/ui generated code for some component types (e.g., `event` handler generics) — document any suppressions
- `next.config.ts` image domains list must include a placeholder for the Supabase storage URL even before the Supabase project exists — use `*.supabase.co` as a wildcard pattern

## Accessibility Notes

- [ ] No accessibility requirements for this infrastructure ticket — the placeholder home page does not need to meet WCAG; accessibility requirements apply to product feature tickets

## QA Test Cases

| #   | Scenario                | Role     | Steps                                                                                                               | Expected result                                                                             |
| --- | ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Dev server starts       | Engineer | Run `pnpm install && pnpm dev`; open `http://localhost:3000`                                                        | Page renders without errors; no 404 in network tab                                          |
| 2   | TypeScript passes       | Engineer | Run `tsc --noEmit`                                                                                                  | Zero errors output                                                                          |
| 3   | Brand colors present    | Engineer | Import `Button` from `components/ui/button` into `app/page.tsx`; render `<Button>Test</Button>`; inspect in browser | Button background is Amber Gold (`#E2A428`)                                                 |
| 4   | `cn()` utility works    | Engineer | Import `cn` from `lib/utils`; call `cn('bg-amber-gold', 'text-cream')` in a component                               | Returns the merged class string without duplication or conflicts                            |
| 5   | `.env.example` complete | Engineer | Compare `.env.example` to `environment-plan.md` Section 5                                                           | All variables in Groups A–D are present with placeholder values; no real keys are committed |

## Security Notes

- `.env.example` must never contain real API keys, secrets, or connection strings — only placeholder strings like `your_supabase_anon_key_here`
- `.gitignore` must include: `.env`, `.env.local`, `.env.development`, `.env.staging`, `.env.production`, `.env.*.local`
- Verify `.gitignore` entries are in place before the first commit

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`) — note: ESLint config is set up in Ticket 005; for this ticket, the default Next.js ESLint config applies
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, empty, error, success) — N/A for infrastructure ticket
- [ ] Mobile tested at 375px — N/A for infrastructure ticket
- [ ] Keyboard navigation tested — N/A for infrastructure ticket
- [ ] Accessibility requirements met — N/A for infrastructure ticket
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
