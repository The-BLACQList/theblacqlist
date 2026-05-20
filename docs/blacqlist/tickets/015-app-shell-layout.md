# Ticket 015: App Shell — Root Layout, Navigation, Fonts, Brand Tokens, Global CSS

## Status
Draft

## Phase
Phase 2: Public Marketing and Discovery Shell

## Priority
P0

## Feature Area
Frontend Shell

## Context
The app shell is the frame inside which every screen on the BLACQList platform renders. It provides the root Next.js layout, font loading, brand CSS variables, global navigation, and the footer. Without this ticket, no screen can render in its correct visual context. Every subsequent frontend ticket depends on the shell existing. Source: `docs/blacqlist/ux/mvp-screen-map.md` (navigation model, all screen layouts), design brief brand reference.

## User Story
As a visitor, I want to see a consistent branded navigation and footer on every page so that I can orient myself, navigate to discovery, and access my account from anywhere on the platform.

## Scope
- `app/layout.tsx` — root layout with `<html lang="en">`, font class application, and global metadata defaults
- `app/globals.css` — brand color CSS variables, Tailwind base, font-face declarations
- `components/nav/Navbar.tsx` — desktop and mobile navigation with logo, nav links, and auth CTA
- `components/nav/MobileDrawer.tsx` — slide-from-right mobile nav drawer
- `components/layout/Footer.tsx` — four-column footer with links, legal row, social icons, tagline
- Font loading: Glacial Indifference via `next/font/local` (from `/public/fonts/`), Lato via `next/font/google`, Quicksand via `next/font/google`
- Brand CSS variables: full set of brand colors, font variables, and spacing tokens
- Navigation links: Discover (`/discover`), For Business (`/for-business`), plus auth-state-conditional items
- Auth state in navbar: Anonymous → "Sign In" text link + "Sign Up" Amber Gold button. Authenticated supporter → avatar dropdown with "My Saved" and "Sign Out". Authenticated owner → avatar dropdown with "My Dashboard" and "Sign Out".
- Active link state using `usePathname()` in a Client Component
- Skip-to-content link as the first focusable element inside `<body>`

## Out of Scope
- Individual page content (each page is a separate ticket)
- Auth flows themselves (Ticket 014)
- Admin navigation (separate admin shell ticket)
- Dashboard sidebar navigation (separate dashboard layout ticket)
- Mobile bottom navigation bar — deferred to after primary screens are implemented

## Dependencies
- Depends on: Ticket 001 — Next.js project initialization (project must exist with Next.js 14+ App Router, TypeScript, Tailwind, shadcn/ui configured)

## UX Notes
- **Screen:** Global — appears on every public page
- **Routes:** All public routes (`/`, `/discover`, `/search`, `/for-business`, `/about`, `/city/[slug]`, `/collection/[slug]`)
- **Entry points:** Every page load
- **Exit points:** Nav links navigate to their destination pages; avatar dropdown navigates to account or dashboard
- **Navbar behavior:**
  - On homepage (`/`): transparent overlay on hero image, transitions to `bg-[#19191E]` with `backdrop-blur-sm` as user scrolls past the hero. This requires a Client Component for scroll detection.
  - On all other pages: `bg-[#19191E]` solid from first paint (no transparent state)
  - Sticky at the top (`sticky top-0 z-50`)
- **Mobile at 375px:** Logo left, hamburger button right. Tapping hamburger opens `MobileDrawer` (full-height, slides from right). Drawer contains: logo at top, nav links stacked vertically, auth CTAs at bottom.
- **Footer:** Four columns on desktop (About BLACQList, Discover, For Businesses, Legal). Single column stack on mobile. Above the columns: BLACQList wordmark and tagline. Below the columns: copyright line, privacy policy link, terms link.

## Design Notes
- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Brand colors (CSS variables in `globals.css`):**
  ```css
  :root {
    --color-brand-black: #000000;
    --color-deep-bg: #19191E;
    --color-charcoal: #595758;
    --color-amber-gold: #E2A428;
    --color-light-gold: #FFD867;
    --color-pale-lavender: #E9E9F7;
    --color-cream: #FCFAF4;
    --font-headline: var(--font-glacial), sans-serif;
    --font-subhead: var(--font-lato), sans-serif;
    --font-body: var(--font-quicksand), sans-serif;
  }
  ```
- **Navbar:**
  - Height: `h-16` (64px)
  - Logo: wordmark SVG in Amber Gold on dark backgrounds
  - Nav links: `text-white text-sm font-medium hover:text-[#E2A428] transition-colors`
  - "Sign In" link: `text-white text-sm`
  - "Sign Up" button: `bg-[#E2A428] text-black text-sm font-bold px-4 py-2 rounded-full hover:bg-[#FFD867]`
  - Active link: `text-[#E2A428]` + `aria-current="page"`
- **Mobile drawer:** `bg-[#19191E] text-white`, full height, slides from right, width `w-72`
- **Footer:** `bg-black text-white`, column headings in Amber Gold, links `text-gray-400 hover:text-white`
- **Components to use:** shadcn/ui `DropdownMenu` for avatar dropdown, `Sheet` for mobile drawer
- **States:** Default / Loading (not applicable) / Error (not applicable for shell) / Authenticated vs Unauthenticated

## Data Notes
- **Tables read:** `user_roles` (to determine nav avatar dropdown options) via `GET /api/me`
- **Operations:** SELECT only (nav rendering)
- **Auth state:** Read from Supabase session via `supabase.auth.getUser()` in a Server Component; passed to the nav Client Component as a prop
- **Migration required:** No

## API Notes
- **`GET /api/me`** (`lib/actions/account/getMe` or via Supabase session) — called once per layout render to determine auth state and roles
- The root layout Server Component calls `supabase.auth.getUser()` to get the session. The session user (or null) is passed as a prop to the nav Client Component.
- Roles are fetched alongside the session: `SELECT role FROM user_roles WHERE user_id = auth.uid()` — result passed as prop to nav
- No error code handling required in the nav — if the session fetch fails, treat as unauthenticated and show sign-in CTA

## Implementation Notes

**Files to create:**
- `app/layout.tsx` — Root layout; Server Component
- `app/globals.css` — Brand variables, Tailwind directives, font-face for Glacial Indifference
- `components/nav/Navbar.tsx` — Server Component shell; extracts scroll-dependent behavior to a child Client Component
- `components/nav/NavbarClient.tsx` — `"use client"` — handles transparent-on-homepage behavior using `usePathname` and `useEffect` scroll listener
- `components/nav/NavLinks.tsx` — `"use client"` — renders nav links with `usePathname` for active state
- `components/nav/AuthNav.tsx` — `"use client"` — renders sign-in/sign-up or avatar dropdown depending on auth prop
- `components/nav/MobileDrawer.tsx` — `"use client"` — shadcn/ui `Sheet` component
- `components/layout/Footer.tsx` — Server Component (static content)
- `components/layout/SkipToContent.tsx` — `<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to content</a>`
- `public/fonts/GlacialIndifference-Bold.woff2` — font file must be sourced and added to the repo

**Files to modify:**
- `tailwind.config.ts` — Add brand color aliases (`amber-gold`, `deep-bg`, `cream`, `charcoal`, `pale-lavender`) and font family aliases

**Font loading in `app/layout.tsx`:**
```typescript
import localFont from 'next/font/local'
import { Lato, Quicksand } from 'next/font/google'

const glacialIndifference = localFont({
  src: '../public/fonts/GlacialIndifference-Bold.woff2',
  variable: '--font-glacial',
  display: 'swap',
})
const lato = Lato({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-lato' })
const quicksand = Quicksand({ subsets: ['latin'], weight: ['700'], variable: '--font-quicksand' })
```

**Navbar transparent scroll behavior (homepage only):**
```typescript
'use client'
// NavbarClient.tsx
const pathname = usePathname()
const [isScrolled, setIsScrolled] = useState(false)
const isHomepage = pathname === '/'

useEffect(() => {
  if (!isHomepage) return
  const handler = () => setIsScrolled(window.scrollY > 80)
  window.addEventListener('scroll', handler, { passive: true })
  return () => window.removeEventListener('scroll', handler)
}, [isHomepage])

const bgClass = isHomepage && !isScrolled
  ? 'bg-transparent'
  : 'bg-[#19191E]'
```

**Key patterns:**
- Pass `user: User | null` and `roles: string[]` as props from the root layout Server Component to `Navbar` — do not call `supabase.auth.getUser()` inside a Client Component
- Use `cn()` from `lib/utils` for conditional Tailwind class merging
- The mobile drawer uses `shadcn/ui Sheet` with `side="right"`
- The avatar dropdown uses `shadcn/ui DropdownMenu`

**Do not:**
- Put `"use client"` on the root layout
- Fetch auth state inside `NavLinks` or `Footer` — only in the root layout Server Component
- Use `window.location` for navigation — use Next.js `Link` and `useRouter`
- Hard-code the Supabase session in the nav — always read from the server-side session

## Acceptance Criteria
- [ ] Root layout renders on every public route with correct brand fonts (Glacial Indifference for headings, Lato for body, Quicksand for CTAs)
- [ ] Brand CSS variables are defined and applied globally — `var(--color-amber-gold)` resolves to `#E2A428` in DevTools
- [ ] Navbar displays "Sign In" text link + "Sign Up" Amber Gold button for unauthenticated users
- [ ] Navbar displays avatar dropdown with role-appropriate links for authenticated users — owner sees "My Dashboard", supporter sees "My Saved"
- [ ] Active nav link displays in Amber Gold (`#E2A428`) and has `aria-current="page"` attribute
- [ ] On homepage, navbar is transparent on first paint and transitions to solid `bg-[#19191E]` after scrolling past 80px
- [ ] On all non-homepage routes, navbar is solid `bg-[#19191E]` from first paint with no transparent phase
- [ ] Mobile drawer opens when hamburger is tapped, contains all nav links, and closes with the × button or backdrop tap
- [ ] Skip-to-content link is the first focusable element and becomes visible on keyboard focus
- [ ] Footer renders with four column sections on desktop and stacks to single column on mobile at 375px

## Failure States

| Failure | User-visible behavior |
|---|---|
| Session fetch fails in root layout | Nav renders unauthenticated state (sign-in + sign-up CTAs). User is not shown an error. If they try to access a protected route, middleware redirects to sign-in. |
| Font files fail to load (network error or missing woff2) | Next.js font fallback activates. Page renders with system sans-serif fonts. No visual error. |
| Supabase client fails to initialize | Console error server-side. Nav renders unauthenticated state. No visible error to the user. |

## Edge Cases
- User signs out while a nav dropdown is open — the dropdown should close on sign-out and the nav should immediately reflect unauthenticated state; this is handled by `revalidatePath('/')` called from the `signOut` Server Action plus client-side router refresh
- Window resize from mobile to desktop while drawer is open — drawer should close or become hidden when viewport exceeds `md` breakpoint
- Long display names in the avatar dropdown — truncate at 20 characters with `truncate` Tailwind class
- User with multiple roles (owner of multiple listings) — avatar dropdown shows "My Dashboard" (any owner role is sufficient to show this link)

## Accessibility Notes
- [ ] Skip-to-content link is the first element in `<body>` and links to `id="main-content"` on the page's `<main>` element
- [ ] Mobile drawer (`Sheet`) traps focus when open — shadcn/ui handles this via `@radix-ui/react-dialog` internals
- [ ] Mobile drawer returns focus to the hamburger button when closed
- [ ] All nav links are keyboard-navigable in logical Tab order (left-to-right on desktop, top-to-bottom in mobile drawer)
- [ ] Avatar dropdown opens on Enter/Space and can be navigated with arrow keys — shadcn/ui `DropdownMenu` handles this
- [ ] Hamburger button has `aria-label="Open navigation"` and `aria-expanded` attribute reflecting drawer state
- [ ] Footer links are keyboard-navigable — `<a>` elements with valid `href` attributes

## QA Test Cases

| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| QA-1 | Anonymous nav state | Anonymous | Open homepage; inspect navbar | "Sign In" text link and "Sign Up" Amber Gold button visible; no avatar or dashboard link |
| QA-2 | Authenticated owner nav state | Owner | Sign in as a user with owner role; inspect navbar | Avatar visible; dropdown shows "My Dashboard" and "Sign Out"; no "Sign Up" button |
| QA-3 | Active link indicator | Any | Navigate to `/discover`; inspect nav links | "Discover" link renders in Amber Gold with `aria-current="page"` attribute |
| QA-4 | Mobile drawer at 375px | Any | Open browser at 375px width; load homepage | Hamburger icon visible; tap hamburger → drawer slides in from right with all nav links; tap × → drawer closes |
| QA-5 | Skip-to-content keyboard access | Any | Load any page; press Tab once | "Skip to content" link appears and is focused; pressing Enter skips to `#main-content` |

## Security Notes
- Auth state is read server-side via `supabase.auth.getUser()` — never trust client-side session state alone for rendering decisions
- The session cookie is httpOnly — JavaScript in the browser cannot read the session token
- Sign-out must invalidate the server-side session via `supabase.auth.signOut()` in the Server Action — client-side cookie deletion alone is insufficient

## Completion Checklist
- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, empty, error, success) — auth state variations tested
- [ ] Mobile tested at 375px — drawer, font sizes, nav link touch targets
- [ ] Keyboard navigation tested — Tab through nav, hamburger, drawer, footer links
- [ ] Accessibility requirements met — skip link, focus trap in drawer, aria-current on active link
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
