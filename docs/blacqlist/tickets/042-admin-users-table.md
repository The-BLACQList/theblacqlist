# Ticket 042: Admin users table — view, role change, suspend (/admin/users)

---

## Status

Backlog

## Phase

Phase 6: Admin Review and Verification

## Priority

P1 — High

## Estimate

L (4–8h)

## Feature Area

Admin / Users

---

## Context

Admins need a full view of all registered platform users, with the ability to change roles and suspend or unsuspend accounts. This is the primary user management surface. Role changes affect what the user can do on their next request; suspensions are checked by middleware on every authenticated route.

Email addresses are sourced from `auth.users` and are only ever visible to admin. They must never appear in any public API or public-facing component.

This ticket covers the `/admin/users` page only — individual user profile detail pages are out of scope for MVP.

Sources: `docs/blacqlist/ux/mvp-screen-map.md` § Admin Users; `docs/blacqlist/architecture/server-actions-plan.md` § 4 (Admin); `docs/blacqlist/ux/empty-loading-error-success-states.md` § 14.7.

---

## User Story

As an admin, I want to view all platform users in a searchable, filterable table and change their roles or suspend their accounts, so that I can manage platform access and respond to abuse or errors quickly.

---

## Scope

**In scope:**

- `app/admin/users/page.tsx` — Server Component, admin-only, accepts `searchParams` for filter/search/page state
- Table columns: display_name, email (from `auth.users` via service_role join), role badges (all roles for the user), status badge (Active / Suspended), created_at, listing count (for users with owner role)
- Filter: role select chip group (All / Supporter / Owner / Admin), status select (All / Active / Suspended)
- Search: text input, debounced, matches email or display_name (contains, case-insensitive)
- Filter + search state persisted in URL search params (`?role=owner&status=active&q=jane`)
- Pagination: 50 rows per page; page controls at bottom
- Row actions (kebab or inline buttons per row):
  - "Change role" → opens `RoleChangeDialog` (role select, confirmation) → calls `updateUserRole` SA
  - "Suspend" → opens `SuspendUserDialog` (reason, confirmation) → calls `suspendUser` SA
  - "Unsuspend" → opens `UnsuspendUserDialog` (confirmation) → calls `unsuspendUser` SA
- All three SAs write to `admin_audit_log`
- Guard at service layer: admin cannot change their own role or suspend themselves — return `FORBIDDEN`
- Loading skeleton: 10 table row stubs; filter bar renders immediately
- All three empty/error states per spec

**Out of scope:**

- Individual user detail/profile page (post-MVP)
- Super Admin-only admin role assignment guard (flag in spec but implemented at service layer for this ticket)
- Bulk user operations
- User deletion

---

## Dependencies

| Dependency                                                  | Type            | Status                                     |
| ----------------------------------------------------------- | --------------- | ------------------------------------------ |
| Ticket 037 — Admin shell + auth middleware                  | Blocking ticket | Not started                                |
| Ticket 008 — `profiles` and `user_roles` tables migration   | Blocking ticket | Not started                                |
| `updateUserRole` SA — `lib/actions/admin/updateUserRole.ts` | Server Action   | Not started (to be created in this ticket) |
| `suspendUser` SA — `lib/actions/admin/suspendUser.ts`       | Server Action   | Not started (to be created in this ticket) |
| `unsuspendUser` SA — `lib/actions/admin/unsuspendUser.ts`   | Server Action   | Not started (to be created in this ticket) |
| `admin_audit_log` table migration                           | Database        | Must exist                                 |
| Service_role client for `auth.users` join                   | Infrastructure  | Must be configured                         |

---

## UX Notes

- **Screen:** Admin Users — `docs/blacqlist/ux/mvp-screen-map.md` § Admin Users
- **Route:** `/admin/users`
- **Layout:** Admin panel — full-width table, admin sidebar left
- **Entry points:** Admin sidebar nav item "Users"
- **Exit points:** Table row action dialogs; no page navigation from individual rows at MVP
- **Filter behavior:** Filter chips and search apply immediately on change; no submit button; URL updates on every change so the filtered view is bookmarkable
- **Mobile behavior:** Table scrolls horizontally on mobile; filter bar collapses to an expandable drawer at 375px; dialogs are full-screen bottom sheets on mobile

**States from `empty-loading-error-success-states.md` § 14.7:**

- Loading: skeleton for 10 table row stubs; filter bar + search render immediately
- Empty: "No users found" — if filters are active, show "Clear filters" button
- Error: "Users couldn't load" + "Try refreshing." + Retry button
- Success: full paginated table
- Role change dialog: loading spinner → success toast "Role updated." + inline badge update → error toast "Role change failed. Try again." (persistent)
- Suspend dialog: loading spinner → success toast "[User name] suspended." + status badge updates → error toast "Suspension failed. Try again." (persistent)

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Components:** shadcn/ui `Table`, `TableHeader`, `TableRow`, `TableCell`, `Badge`, `Button` (ghost for row actions, destructive for Suspend), `Dialog`, `Select`, `Input`, `Skeleton`, `DropdownMenu` (kebab per row)
- **Role badges:** Rendered as multiple `Badge` components per user — one per role. Supporter = gray, Owner = Amber Gold outline, Admin = Brand Black
- **Status badge:** Active = green, Suspended = red
- **Filter chips:** Rendered as a `SegmentedControl` or `RadioGroup` pill bar for role; a separate `Select` for status
- **Search input:** Debounced 300ms; uses a `useSearchParams`/`useRouter` pattern to write to URL
- **Kebab menu:** `DropdownMenu` per row; items: "Change role", "Suspend" / "Unsuspend" (toggled by status)
- **Destructive actions:** "Suspend" uses the `destructive` variant; "Confirm Suspension" button is red
- **States to implement:** Loading (skeleton), Idle, Dialog loading, Dialog success, Dialog error, Empty, Empty with filters, Error (table-level)

---

## Data Notes

- **Data model:** `docs/blacqlist/architecture/data-model.md` → `profiles`, `user_roles`, `auth.users`
- **Entities involved:** `profiles`, `user_roles`, service_role access to `auth.users` for email
- **Operations:**
  - SELECT: `profiles` JOIN `user_roles` JOIN `auth.users` (service_role) with search/filter/pagination
  - `updateUserRole`: INSERT or UPDATE in `user_roles`; INSERT `admin_audit_log` (`role_assigned` or `role_revoked`)
  - `suspendUser`: UPDATE `profiles.suspended_at = now()` (and/or `profiles.suspended_until`); INSERT `admin_audit_log`
  - `unsuspendUser`: UPDATE `profiles.suspended_at = null`; INSERT `admin_audit_log`
- **Validation rules:**
  - `updateUserRole`: new role must be `'supporter'` | `'owner'` | `'admin'`; admin can only assign `'admin'` if they have `super_admin` role (validated server-side)
  - `suspendUser`: reason optional but recommended; max 500 chars
  - Admin cannot change their own role or suspend themselves — guard: `target_user_id != auth.uid()`
- **RLS policies:** `auth.users` only accessible via service_role; `profiles` and `user_roles` accessible via admin RLS or service_role
- **Migration required:** No new migration — tables from Ticket 008; `admin_audit_log` from Ticket 012

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/server-actions-plan.md` § 4 (Admin) + `docs/blacqlist/architecture/api-contract.md` § Admin (Section 9)

**Server Actions to create in this ticket:**

| Action           | File                                  | What it does                                                                                    |
| ---------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `updateUserRole` | `lib/actions/admin/updateUserRole.ts` | Updates `user_roles` for target user; inserts `role_assigned` or `role_revoked` audit log entry |
| `suspendUser`    | `lib/actions/admin/suspendUser.ts`    | Sets `profiles.suspended_at = now()`; inserts audit log entry                                   |
| `unsuspendUser`  | `lib/actions/admin/unsuspendUser.ts`  | Clears `profiles.suspended_at`; inserts audit log entry                                         |

**Auth required:** Yes — Admin role (verified server-side)

**Error codes to handle:**

| Code               | Condition                          | UI shows                                        |
| ------------------ | ---------------------------------- | ----------------------------------------------- |
| `AUTH_REQUIRED`    | Session expired                    | Redirect to `/sign-in?next=[current-url]`       |
| `FORBIDDEN`        | Not admin, or admin targeting self | Toast: "You cannot modify your own account."    |
| `NOT_FOUND`        | Target user does not exist         | Toast: "User not found." — row stays in table   |
| `VALIDATION_ERROR` | Invalid role value                 | Inline error in dialog                          |
| `OPERATION_FAILED` | Unexpected DB error                | Persistent toast: "[Action] failed. Try again." |

---

## Implementation Notes

**Files to create:**

- `app/admin/users/page.tsx` — Server Component; reads `searchParams`; fetches users via service_role
- `components/admin/users/UsersTable.tsx` — table with columns, sorting, pagination
- `components/admin/users/UserFiltersBar.tsx` — "use client"; role/status chips + search input; writes to URL params
- `components/admin/users/RoleChangeDialog.tsx` — "use client"; role select + confirmation
- `components/admin/users/SuspendUserDialog.tsx` — "use client"; reason textarea + destructive confirm
- `components/admin/users/UnsuspendUserDialog.tsx` — "use client"; simple confirmation dialog
- `lib/actions/admin/updateUserRole.ts` — Server Action
- `lib/actions/admin/suspendUser.ts` — Server Action
- `lib/actions/admin/unsuspendUser.ts` — Server Action

**Files to modify:**

- `app/admin/layout.tsx` (or sidebar component) — ensure "Users" nav item links to `/admin/users`

**Key patterns:**

- Use service_role client to join `auth.users` for email — never use anon or session-scoped client for this join; email must not be returned by any public-facing endpoint
- All three SAs follow the 7-step pattern from `server-actions-plan.md` § 3
- `insertAuditLog` called in Step 5 for all three SAs; for `updateUserRole`, snapshot `{ role, listing_id }` in `before_state` (current role) and `after_state` (new role)
- Filter + search state in URL: `UserFiltersBar` is a Client Component; page component reads `searchParams` as a Server Component
- Role change for `owner` role should include the `listing_id` the owner role is scoped to — display this in the dialog: "Owner of [Listing Name]"
- Suspension check in middleware: `middleware.ts` should check `profiles.suspended_at IS NOT NULL` for authenticated routes — this must be implemented alongside this ticket

**Do not:**

- Expose `auth.users` email in any Route Handler or client-accessible API
- Allow an admin to change their own role or suspend themselves — enforce at both the service layer AND by hiding the action in the UI row for the current admin's own row
- Use client-side role checks to guard the page — rely solely on middleware + server-side checks

---

## Acceptance Criteria

- [ ] Given the admin navigates to `/admin/users`, then a table renders with all users; columns show display_name, email, role badges, status badge, created_at, and listing count (for owners)
- [ ] Given filter chips are changed, then the URL updates and the table re-fetches with the new filter applied; no submit button is needed
- [ ] Given the admin types in the search input, then after a 300ms debounce the URL updates and the table re-fetches filtering by email or display_name contains the query
- [ ] Given the admin opens the "Change role" dialog for a user, then the current role is shown and a role selector is available; clicking "Confirm" calls `updateUserRole`, the dialog closes, a success toast shows, and the role badge updates inline
- [ ] Given the admin clicks "Suspend" on an active user, then a confirmation dialog opens; on confirm, `suspendUser` is called, the status badge updates to "Suspended" inline, a success toast shows, and the "Suspend" action is replaced by "Unsuspend"
- [ ] Given the admin clicks "Unsuspend" on a suspended user, then a confirmation dialog opens; on confirm, `unsuspendUser` is called, the status badge updates to "Active" inline, and a success toast shows
- [ ] Given the admin's own row is in the table, then the "Change role" and "Suspend" actions are hidden or disabled for that row
- [ ] Given an SA returns `FORBIDDEN` (admin targeting self), then a toast shows "You cannot modify your own account."
- [ ] Loading state: 10 skeleton table row stubs show while data fetches; filter bar renders immediately
- [ ] Empty state with no filters: "No users found" — (should not occur post-launch but handled)
- [ ] Empty state with active filters returning zero: "No users found" with "Clear filters" button
- [ ] Error state: "Users couldn't load" + "Retry" button
- [ ] Pagination: 50 rows per page; page controls work; URL reflects current page
- [ ] Mobile at 375px: table scrolls horizontally; filter bar collapses to a drawer; dialogs render as bottom sheets

---

## Failure States

| Failure              | Condition                                           | User sees                                                              | Recovery                |
| -------------------- | --------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------- |
| Table fetch fails    | DB query error                                      | "Users couldn't load. Try refreshing." + Retry button                  | Retry re-runs the query |
| Role change SA fails | DB error                                            | Persistent toast: "Role change failed. Try again." Dialog remains open | Retry the dialog action |
| Suspend SA fails     | DB error                                            | Persistent toast: "Suspension failed. Try again." Dialog remains open  | Retry the dialog action |
| Admin targets self   | `target_user_id = auth.uid()`                       | Toast: "You cannot modify your own account."                           | No action taken         |
| User not found       | Target user deleted between table load and action   | Toast: "User not found." — row stays in table until next refresh       | Refresh the page        |
| Session expired      | 401 from any SA                                     | Redirect to `/sign-in?next=[current-url]`                              | Re-authenticate         |
| Non-admin access     | User without admin role navigates to `/admin/users` | Middleware redirect to `/dashboard`                                    | N/A                     |

---

## Edge Cases

- A user has multiple roles (e.g., both `supporter` and `owner`) — all role badges are rendered; "Change role" dialog shows all current roles and allows updating them individually
- A user was suspended and then their suspension record was manually cleared in the DB — status badge correctly reflects the DB state on next page load
- Search query contains special characters (e.g., `@`, `+`, `%`) — query is parameterized; no SQL injection risk; UI handles gracefully
- Very long display name or email — text truncates with ellipsis in the table cell; full value visible in a tooltip or dialog
- Admin changes a user from `owner` to `supporter` for a user who has a listing — the listing remains; only the role record changes; a warning is shown in the dialog: "This user's listing will remain but they will lose owner-level access"
- Filtering by "Admin" role returns zero results on a small platform — filtered empty state renders with "Clear filters" button

---

## Accessibility Notes

- [ ] All interactive elements (chips, search input, kebab menus, dialog buttons) are keyboard-reachable in logical tab order
- [ ] Dialog focus: moves to the dialog on open; returns to the triggering button on close/cancel
- [ ] Role change and suspend dialogs have descriptive `aria-labelledby` pointing to the dialog heading
- [ ] Status badges use `aria-label` in addition to color (e.g., `aria-label="Status: Suspended"`) — color is never the sole indicator
- [ ] Role badges use descriptive text (e.g., `aria-label="Role: Business Owner"`)
- [ ] Search input has an associated `<label>` or `aria-label="Search users by name or email"`
- [ ] Success and error toasts use `role="alert"` for screen reader announcement
- [ ] Skeleton rows include `aria-busy="true"` on the table container during load

---

## QA Test Cases

| ID   | Test                     | Steps                                                                                                                                                                     | Expected                                                                                                                                                          |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QA-1 | Happy path: change role  | 1. Log in as admin. 2. Navigate to `/admin/users`. 3. Open kebab menu on a supporter user. 4. Click "Change role". 5. Select "Owner" from the select. 6. Click "Confirm". | `updateUserRole` called. Role badge updates from "Supporter" to "Owner" inline. Toast: "Role updated." `admin_audit_log` entry created.                           |
| QA-2 | Happy path: suspend user | 1. Click "Suspend" on an active user. 2. Enter a reason. 3. Click "Confirm Suspension".                                                                                   | `suspendUser` called. Status badge updates to "Suspended". Toast: "[User name] suspended." `admin_audit_log` entry. "Suspend" row action replaced by "Unsuspend". |
| QA-3 | Self-modification guard  | 1. Locate the current admin's own row.                                                                                                                                    | "Change role" and "Suspend" actions are hidden or disabled. If attempted via SA directly, returns FORBIDDEN.                                                      |
| QA-4 | Filter and search        | 1. Set role filter to "Owner". 2. Type "atlanta" in the search field.                                                                                                     | Table re-fetches immediately showing only owners with "atlanta" in name or email. URL reflects `?role=owner&q=atlanta`.                                           |
| QA-5 | Mobile at 375px          | 1. Open `/admin/users` on a 375px viewport. 2. Interact with filters and rows.                                                                                            | Table scrolls horizontally. Filter bar is accessible. Dialogs render as full-screen bottom sheets.                                                                |
| QA-6 | Permission boundary      | 1. Log in as an owner. 2. Navigate directly to `/admin/users`.                                                                                                            | Middleware redirects to `/dashboard`. Page is not rendered.                                                                                                       |

---

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] User table renders with all columns including email (via service_role)
- [ ] Email field confirmed: not returned by any public-facing Route Handler
- [ ] `updateUserRole` SA: audit log entry `role_assigned` / `role_revoked` written
- [ ] `suspendUser` SA: `profiles.suspended_at` set; audit log entry written
- [ ] `unsuspendUser` SA: `profiles.suspended_at` cleared; audit log entry written
- [ ] Self-modification guard tested via SA direct call (not just UI hiding)
- [ ] Filter + search state in URL — page survives refresh with filters applied
- [ ] Pagination tested: 50 rows per page
- [ ] Loading, empty, error states tested
- [ ] Mobile tested at 375px — horizontal scroll, filter drawer, dialog bottom sheet
- [ ] Keyboard navigation tested — dialog focus management
