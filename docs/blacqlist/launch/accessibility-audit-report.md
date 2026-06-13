# Accessibility Audit Report — The BLACQList

**Ticket:** 087  
**Standard:** WCAG 2.1 AA  
**Status:** Pending — to be executed on staging environment  
**Tools required:** axe DevTools browser extension, Colour Contrast Analyser, VoiceOver (macOS, Cmd+F5)

---

## Summary

| Category | Screens | Critical | High | Medium | Status |
|---|---|---|---|---|---|
| axe automated scan | 37 | — | — | — | Pending |
| Keyboard navigation | 37 | — | — | — | Pending |
| Color contrast | Key pairs | — | — | — | Pending |
| Screen reader (VoiceOver) | 5 critical flows | — | — | — | Pending |
| Form labels | All forms | — | — | — | Pending |
| Modal focus traps | All modals | — | — | — | Pending |

**Go/No-Go:** PENDING

---

## Color Contrast: Brand Palette

Verify these pairs with Colour Contrast Analyser before touching any other screen.

| Text | Background | Required | Result | Pass? |
|---|---|---|---|---|
| `#000000` | `#E2A428` (amber gold buttons) | 4.5:1 | Pending | |
| `#000000` | `#FCFAF4` (cream background) | 4.5:1 | Pending | |
| `#595758` (charcoal) | `#FCFAF4` (cream) | 4.5:1 | Pending | |
| `#FCFAF4` | `#000000` (brand black) | 4.5:1 | Pending | |
| `#E2A428` | `#19191E` (deep bg, nav) | 3:1 (large text) | Pending | |
| `#595758` | `#ffffff` (white card bg) | 4.5:1 | Pending | |

---

## Screen Inventory (37 MVP Screens)

### Public Discovery
| # | Screen | URL | axe | Keyboard | Heading OK | Landmarks OK | Status |
|---|---|---|---|---|---|---|---|
| 1 | Homepage | `/` | | | | | Pending |
| 2 | Search results | `/search` | | | | | Pending |
| 3 | City landing | `/city/[slug]` | | | | | Pending |
| 4 | City-category | `/city/[slug]/[cat]` | | | | | Pending |
| 5 | BLACQList Page | `/[city]/business/[slug]` | | | | | Pending |
| 6 | Discover/browse | `/discover` | | | | | Pending |

### Auth Screens
| # | Screen | URL | axe | Keyboard | Form labels | Error announced | Status |
|---|---|---|---|---|---|---|---|
| 7 | Sign-up | `/sign-up` | | | | | Pending |
| 8 | Sign-in | `/sign-in` | | | | | Pending |
| 9 | Forgot password | `/forgot-password` | | | | | Pending |
| 10 | Reset password | `/reset-password` | | | | | Pending |
| 11 | Verify email | `/verify-email` | | | | | Pending |
| 12 | Onboarding | `/onboarding` | | | | | Pending |

### Submit and Claim
| # | Screen | URL | axe | Keyboard | Form labels | Status |
|---|---|---|---|---|---|---|
| 13–19 | Add Business steps 1–7 | `/add-business` | | | | Pending |
| 20 | Claim entry | `/claim` | | | | Pending |
| 21 | Claim form | `/claim/[id]` | | | | Pending |
| 22 | Claim status | `/account/claims` | | | | Pending |

### Account
| # | Screen | URL | axe | Keyboard | Status |
|---|---|---|---|---|---|
| 23 | Saved listings | `/account/saved` | | | Pending |

### Owner Dashboard
| # | Screen | URL | axe | Keyboard | Status |
|---|---|---|---|---|---|
| 24 | Dashboard home | `/dashboard` | | | Pending |
| 25 | Page editor — basic | `/dashboard/pages/[id]/edit` | | | Pending |
| 26 | Analytics | `/dashboard/pages/[id]/analytics` | | | Pending |

### Admin Screens
| # | Screen | URL | axe | Keyboard | Status |
|---|---|---|---|---|---|
| 27 | Admin listings | `/admin/listings` | | | Pending |
| 28 | Admin listing detail | `/admin/listings/[id]` | | | Pending |
| 29 | Admin claims queue | `/admin/claims` | | | Pending |
| 30 | Admin claim review | `/admin/claims/[id]` | | | Pending |
| 31 | Admin users | `/admin/users` | | | Pending |
| 32 | Admin collections | `/admin/collections` | | | Pending |
| 33 | Admin collection editor | `/admin/collections/[id]` | | | Pending |
| 34 | Admin categories | `/admin/categories` | | | Pending |
| 35 | Admin analytics | `/admin/analytics` | | | Pending |
| 36 | Admin search analytics | `/admin/analytics/search` | | | Pending |

### Static/Utility
| # | Screen | URL | axe | Keyboard | Status |
|---|---|---|---|---|---|
| 37 | 404 | `/404` | | | Pending |

---

## 5 Critical Flows — VoiceOver Test Results

### Flow 1: Homepage → Search → Listing Page → Save
```
Steps:
1. Open homepage with VoiceOver active (Cmd+F5)
2. Navigate to search input using Tab
3. Type a search query; confirm results count announced
4. Tab to first result card; activate with Enter
5. Verify listing page landmarks announced (main, header, nav)
6. Tab to Save button; activate
7. Confirm redirect to /sign-in is announced (page navigation announced by screen reader)
8. Sign in; confirm redirect back to listing page
9. Tab to Save button again; confirm save succeeds

Pass criteria: All steps completable. Screen reader announces each step correctly.
Result: PENDING
```

### Flow 2: Sign-up → Onboarding
```
Steps:
1. Navigate to /sign-up with VoiceOver
2. Tab through all form fields; verify each announced with label
3. Submit form with invalid email; verify error announced
4. Complete sign-up; verify success/verification state announced
5. Navigate onboarding steps

Pass criteria: All fields have labels. Errors announced via aria-live. 
Result: PENDING
```

### Flow 3: Claim Flow
```
Steps:
1. Find a published listing page; tab to "Claim this business"
2. Navigate claim entry page; verify instructions announced
3. Complete claim form; verify all fields labeled
4. Submit claim; verify success state announced

Pass criteria: Claim form completable with keyboard + VoiceOver only.
Result: PENDING
```

### Flow 4: Owner Dashboard — Page Editor
```
Steps:
1. Sign in as Owner; navigate to /dashboard
2. Tab through dashboard cards to "Edit page" link
3. Navigate page editor — verify all section headings announced
4. Update a field; save; verify success announced

Pass criteria: All editor sections reachable and operable by keyboard.
Result: PENDING
```

### Flow 5: Admin Claims Queue
```
Steps:
1. Sign in as Admin; navigate to /admin/claims
2. Tab through claims table rows
3. Activate "Review" on first claim; verify detail page loads
4. Tab to Approve/Reject buttons; verify labels announced
5. Confirm action; verify success state announced

Pass criteria: Claims queue fully operable by keyboard + VoiceOver.
Result: PENDING
```

---

## Known Pre-Checks (completed before audit)

Based on code review, these were proactively verified:

- [x] CSV download `<a>` tags in admin analytics pages have `aria-label` attributes
- [x] Skip-to-main-content link present in root layout (`href="#main-content"`)
- [x] `<main id="main-content">` present in root layout
- [ ] Search results count announced via `aria-live` — **to verify**
- [ ] All icon-only buttons have `aria-label` — **to verify with axe scan**
- [ ] shadcn/ui focus rings preserved in custom className overrides — **to verify**

---

## Findings Log

*To be populated during audit execution.*

| ID | Screen | Severity | Description | File | Fix | Status |
|---|---|---|---|---|---|---|
| — | — | — | No findings yet | — | — | — |

---

## Go/No-Go Recommendation

**PENDING** — Execute audit in staging environment and update this document.

**Go criteria:**
- axe automated scan: zero Critical violations across all 37 screens
- All form inputs have associated `<label>` elements
- All modal dialogs trap focus and return focus on close
- 5 critical flows completable with VoiceOver + keyboard only
- All Critical findings remediated and re-tested
