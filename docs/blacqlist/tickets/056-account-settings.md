# Ticket 056: Account settings — profile update, password change, delete account (`/account/settings`)

## Status
Draft

## Phase
Phase 9: Supporter Account

## Priority
P1

## Feature Area
Supporter Account

## Context
Account settings screen available to all authenticated users (both owners and supporters). Three distinct sections: (1) **Profile** — update `display_name` and avatar (upload to `avatars` bucket, store path on `profiles.avatar_url`); (2) **Security** — change password via Supabase Auth `updateUser`; (3) **Delete account** — two-step confirmation requiring the user to type "DELETE" before calling the `deleteAccount` SA, which soft-deletes the profile record and signs the user out. The screen is protected by auth middleware (Ticket 058). For owners, account deletion is a significant action — a warning note informs them that their BLACQList Page will also be affected (admin follow-up required; the SA does not cascade-delete listings at MVP).

Source documents: `docs/blacqlist/ux/mvp-screen-map.md` (Account Settings `/account/settings`), `docs/blacqlist/architecture/server-actions-plan.md` (`updateProfile`, `deleteAccount`), `docs/blacqlist/data/database-schema-plan.md` (`profiles`), `docs/blacqlist/ux/empty-loading-error-success-states.md` (Section 6 — Auth States).

## User Story
As an authenticated user, I want to update my display name and avatar, change my password, and optionally delete my account, so that I control my personal information and can leave the platform if needed.

## Scope
- `app/account/settings/page.tsx` — Server Component that fetches the current user's `profiles` row and renders the settings form
- `app/account/settings/components/ProfileSection.tsx` — Client Component: display_name `<Input>` + avatar upload (`<input type="file">` with image preview); "Save changes" button fires `updateProfile` SA
- `app/account/settings/components/SecuritySection.tsx` — Client Component: change-password expandable section; current password + new password + confirm password fields; "Update password" button calls `supabase.auth.updateUser({ password })`
- `app/account/settings/components/DeleteAccountSection.tsx` — Client Component: danger zone card; "Delete Account" button opens `AlertDialog`; user must type "DELETE" in a confirmation input before the confirm button enables; on confirm, fires `deleteAccount` SA + `supabase.auth.signOut()` + redirect to `/`
- Avatar upload: `POST /api/upload` targeting the `avatars` bucket; stores path in `profiles.avatar_url`; generates public URL at read time
- Email display: read-only `<Input>` showing the current auth email (email changes deferred to V1 per the UX spec)

## Out of Scope
- Email address change (V1 — requires a re-verification confirmation flow)
- OAuth provider password note (V1)
- Notification preferences (covered by Ticket 057 onboarding — only basic prefs at MVP)
- Multi-account management or role display on this screen

## Dependencies
- Depends on: Ticket 014 (auth flows — `updateUser`, session management)
- Depends on: Ticket 015 (app shell — shared account sidebar layout)
- Depends on: Ticket 058 (auth middleware — `/account` routes are protected)
- Depends on: Ticket 008 (`profiles` table), Ticket 013 (RLS)
- Depends on: Ticket 030 (`POST /api/upload` — avatar upload; if not yet live, avatar upload can be stubbed with a TODO)

## UX Notes
- **Screen:** Account Settings — `docs/blacqlist/ux/mvp-screen-map.md` → "Account Settings (`/account/settings`)"
- **Route:** `/account/settings`
- **Layout:** Dashboard sidebar layout (same sidebar as `/account/saved`)
- **Entry point:** User avatar dropdown in the top nav → "Settings"; or sidebar nav "Settings" item
- **Profile section:** Display name text input (current value pre-filled). Email input: read-only, Charcoal text color, with a note "Email changes are not available yet." Avatar: circular image preview (48px diameter); "Change photo" ghost button overlays the preview. "Save changes" Amber Gold button.
- **Security section:** A "Change Password" row with a down-chevron; clicking expands an inline form: "Current Password", "New Password" (min 8 chars), "Confirm New Password". "Update Password" button. If passwords don't match, inline error below confirm field.
- **Delete account section:** Danger zone card with red/destructive border. Copy: "Permanently delete your BLACQList account. If you own a BLACQList Page, it will remain visible until an administrator reviews your account." "Delete Account" button (destructive variant).
  - Confirmation dialog heading: "Are you sure?" Body: "This action cannot be undone. Type DELETE to confirm." Confirmation input field. "Confirm deletion" button (red, disabled until input equals "DELETE" exactly). "Cancel" button.
- **Mobile (375px):** Sections stack; avatar preview is centered; all buttons full-width; delete section at the bottom of the page
- **Loading state:** Page-level skeleton while Server Component fetches profile data
- **Empty state:** Not applicable — user always has a profile if authenticated
- **Error state:** Section-level toast on SA failure; field-level inline errors for validation failures
- **Success state:** "Profile saved." toast after profile update; "Password updated." toast after password change; signed out and redirected to `/` after account deletion

## Design Notes
- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md`
- **Colors:** Amber Gold `#E2A428` for "Save changes" button; red destructive for delete section border, delete button, and confirm button; Charcoal `#595758` for read-only email field; `#E9E9F7` Pale Lavender for expand area background
- **Fonts:** Glacial Indifference Bold for "Settings" page heading; Lato Regular for labels; Quicksand Bold Italic for primary action buttons
- **Components:** shadcn/ui `Input`, `Label`, `Button` (default, destructive, ghost), `AlertDialog` (delete confirmation), `Card` (danger zone), `Separator` (between sections), `Avatar` (from shadcn/ui for the circular avatar preview)
- **States:** Default (loaded, forms populated), Loading skeleton, Saving (button spinner), Success (toast), Error (inline + toast)

## Data Notes
- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `profiles`
- **Fields:** `profiles.display_name` (text, optional), `profiles.avatar_url` (text, optional — storage path in `avatars` bucket), `profiles.bio` (optional — not exposed in this form at MVP), `profiles.updated_at`
- **Operations:**
  - SELECT: `profiles WHERE id = auth.uid()` — fetched in Server Component
  - UPDATE via `updateProfile` SA: `display_name`, `avatar_url`, `updated_at` (trigger)
  - Password change: Supabase Auth `supabase.auth.updateUser({ password: newPassword })` — called client-side with the current session; NOT a custom SA (Supabase handles it)
  - Account delete via `deleteAccount` SA: server-side — soft-delete `profiles` row (or hard delete if no PII retention requirement); call `supabase.auth.admin.deleteUser(userId)` via service role to remove the auth user record; then `supabase.auth.signOut()` client-side post-SA
- **Validation rules:** `display_name`: optional, max 100 chars; avatar: max 2MB, image/jpeg + image/png + image/webp only; password: min 8 chars, Supabase Auth enforces; confirmation input for delete must equal "DELETE" exactly (case-sensitive)
- **RLS:** `profiles` UPDATE only where `id = auth.uid()`; `deleteAccount` SA uses service role to bypass RLS for auth user deletion
- **Migration required:** No — `profiles` table exists from Ticket 008

## API Notes
- **Server Actions plan:** `docs/blacqlist/architecture/server-actions-plan.md` → `updateProfile` (`lib/actions/account/updateProfile.ts`), `deleteAccount` (`lib/actions/account/deleteAccount.ts`)
- **`updateProfile(input)`:** `{ displayName?: string, avatarUrl?: string }` → `ActionResult<{ updated: true }>`; validates display_name length; updates `profiles` row
- **`deleteAccount(input)`:** `{ userId: string }` — server validates `userId === auth.uid()`; calls `supabase.auth.admin.deleteUser(userId)` via service role; returns `ActionResult<{ deleted: true }>`; caller then calls `supabase.auth.signOut()` and redirects
- **Password change:** NOT a Server Action — call `supabase.auth.updateUser({ password })` directly from a Client Component using the browser Supabase client; handle `AuthApiError` responses
- **Avatar upload:** `POST /api/upload` — `multipart/form-data`; fields: `file`, `entityType='user'`, `entityId=[userId]`, `mediaRole='avatar'`; bucket: `avatars`; returns `{ data: { filePath: string } }`; pass `filePath` to `updateProfile`
- **Error codes:** `AUTH_REQUIRED`, `VALIDATION_ERROR` (display_name too long), `OPERATION_FAILED` (DB error in updateProfile), Supabase Auth errors for password change (wrong current password, too weak)

## Implementation Notes
**Files to create:**
- `app/account/settings/page.tsx`
- `app/account/settings/components/ProfileSection.tsx`
- `app/account/settings/components/SecuritySection.tsx`
- `app/account/settings/components/DeleteAccountSection.tsx`
- `lib/actions/account/updateProfile.ts` (if not already scaffolded)
- `lib/actions/account/deleteAccount.ts` (if not already scaffolded)

**Files to modify:**
- `app/account/layout.tsx` (if account sidebar layout exists) — confirm "Settings" nav item is present and active on this route
- `lib/validations/account.ts` — add `profileUpdateSchema`, `passwordChangeSchema`

**Key patterns:**
- Avatar upload follows the same pattern as cover image upload in Ticket 051: `POST /api/upload` → receive `filePath` → call `updateProfile` SA
- Password change uses the browser Supabase client (`createBrowserClient` from `@supabase/ssr`) — the only exception to the "use server-side client" rule, because `updateUser` with current password requires the current auth session which is available browser-side
- Delete confirmation: the "Confirm deletion" button's `disabled` prop is computed from `confirmInput !== 'DELETE'` — update reactively via `onChange`
- After `deleteAccount` SA succeeds, call `supabase.auth.signOut()` client-side and then `router.push('/')`; do not use `redirect()` inside the SA (SA should return success, caller handles navigation)
- Generate avatar URL at read time in the Server Component: `supabase.storage.from('avatars').getPublicUrl(profile.avatar_url)`

**Do not:**
- Store avatar CDN URLs in `profiles.avatar_url` — store only the storage path
- Hard-delete the user's saved listings or reviews as part of `deleteAccount` at MVP — those are handled by the `ON DELETE SET NULL` / `ON DELETE CASCADE` FK rules defined in the schema

## Acceptance Criteria
- [ ] `/account/settings` loads with the current `display_name` and avatar pre-populated
- [ ] Email field is read-only and shows the current auth email
- [ ] Owner can update their display name and save via `updateProfile` SA; toast confirms "Profile saved."
- [ ] Avatar upload accepts JPEG/PNG/WebP under 2MB; new avatar appears after upload; path is saved to `profiles.avatar_url`
- [ ] Uploading an invalid file type shows toast: "Only JPEG, PNG, and WebP images are accepted."
- [ ] Password change section expands on click; entering valid current password + matching new passwords updates the password via Supabase Auth; toast: "Password updated."
- [ ] Password fields show inline error if new password is under 8 characters or if confirm doesn't match
- [ ] Delete account danger zone is visually distinct (red border card)
- [ ] Clicking "Delete Account" opens the confirmation dialog
- [ ] Confirm deletion button is disabled until the user types "DELETE" exactly
- [ ] Confirming deletion fires `deleteAccount` SA; user is signed out; redirected to `/`
- [ ] Mobile (375px): all sections stack; all buttons are full-width; dialog is accessible
- [ ] `tsc --noEmit` and `npm run lint` pass with zero errors

## Failure States
| Failure | User-visible behavior |
|---|---|
| `updateProfile` returns `OPERATION_FAILED` | Toast: "Couldn't save your profile. Try again." |
| Avatar upload fails | Toast: "Avatar upload failed. Try a different image." Previous avatar remains |
| Password change: wrong current password | Inline error below current password field: "Current password is incorrect." |
| Password change: Supabase Auth error (too weak) | Inline error: "Password must be at least 8 characters." |
| `deleteAccount` SA fails | Dialog stays open; error in dialog: "Account deletion failed. Please contact support@theblacqlist.com." |
| "DELETE" input doesn't match exactly | Confirm button remains disabled; no error shown (disabled state communicates it) |

## Edge Cases
- User changes display name to whitespace only — trim before validation; zod `.trim().min(1)` shows: "Display name cannot be empty."
- User uploads an avatar while the previous avatar is being saved — disallow concurrent uploads; disable the "Change photo" button while a save is in flight
- User clicks "Delete Account" and then navigates away before confirming — dialog closes; account is not deleted
- User with an `owner` role deletes their account — the warning note in the delete section informs them their listing is affected; the SA does not delete the listing (FK ON DELETE SET NULL for `owner_user_id`); admin must manually review
- Password change for a user who signed up via OAuth (V1 feature) — at MVP, assume all users have email/password auth; the security section is always shown

## Accessibility Notes
- [ ] Page heading "Settings" is `<h1>`; section headings ("Profile", "Security", "Delete Account") are `<h2>`
- [ ] Avatar upload `<input type="file">` has associated `<label>`: "Upload profile photo"
- [ ] The "Change photo" overlay button has `aria-label="Change profile photo"`
- [ ] Password inputs have `autocomplete="current-password"` and `autocomplete="new-password"` respectively
- [ ] Confirm deletion input has `aria-label="Type DELETE to confirm account deletion"` and `aria-required="true"`
- [ ] Delete confirmation dialog is a `role="alertdialog"` (destructive action) with `aria-modal="true"`
- [ ] Error messages linked to inputs via `aria-describedby`
- [ ] Security section expand/collapse toggle has `aria-expanded` state

## QA Test Cases
| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| 1 | Update display name | Supporter | 1. Change display name. 2. Click "Save changes". | `updateProfile` SA fires; toast "Profile saved."; DB record updated |
| 2 | Upload avatar | Supporter | 1. Click "Change photo". 2. Select valid JPEG. | Avatar uploads; new avatar path saved; preview updates |
| 3 | Change password | Supporter | 1. Expand security section. 2. Enter correct current password + valid new password. 3. Submit. | Password updated via Supabase Auth; toast "Password updated." |
| 4 | Delete account — confirm | Supporter | 1. Click "Delete Account". 2. Type "DELETE" in confirm input. 3. Click confirm. | `deleteAccount` SA fires; user signed out; redirected to `/` |
| 5 | Delete account — cancel | Supporter | 1. Click "Delete Account". 2. Click "Cancel" in dialog. | Dialog closes; account unchanged |

## Security Notes
- `deleteAccount` SA verifies `userId === auth.uid()` server-side — cannot delete another user's account
- Avatar upload route validates MIME type from file magic bytes; generates UUID-based storage path
- Password change uses Supabase's native `updateUser` which re-validates the current session
- The "DELETE" confirmation input comparison is case-sensitive — `'DELETE' !== 'delete'`
- `deleteAccount` SA uses service role for `auth.admin.deleteUser()` — never exposes the service role key client-side

## Completion Checklist
- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading skeleton, populated, saving, error/success)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested
- [ ] Accessibility requirements met
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
