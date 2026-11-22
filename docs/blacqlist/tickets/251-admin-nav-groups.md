# Ticket 251: Admin Menu in Groups, With a Phone Menu

**Status:** Merged 2026-11-21 (#376, `276644e`), on the founder's OK.

## Why

The founder (2026-11-21): "Same with the admin pages. We need some collapsable sections on that side panel, etc. User friendly."

Before this ticket:
- The admin side menu was one flat list of 19 links in no particular order.
- On a phone the 224px menu sat beside the page with no way to hide it, so every admin page scrolled sideways.

The founder picked the groups (AskUserQuestion) and approved the admin board in the signed-in mockup canvas ("I like A and I like the admin page").

## What Changed

- **`lib/admin/navGroups.ts`**: the menu as plain data.
  - Overview sits on its own at the top.
  - The groups:
    - **To Review**: Claims, Verification, Reviews, Reports, Category Requests, Receipts, Feedback
    - **Pages & Content**: Entities, Collections, Guides, BLACQLight, Sponsored, Marketplace
    - **People**: Users, Testers
    - **Insights**: Analytics, AI Tools
    - **Tools**: Email Preview
  - Helpers: `groupForPath`, `groupCount`, `totalCount`, `parseOpenGroups`.
- **`components/admin/AdminSidebar.tsx`**:
  - **Groups.** Each group header is a button with `aria-expanded`. The group holding the page you're on is always open, and its header can't close it.
  - **Counts.** A closed group shows the total waiting inside it as a gold pill. Item pills are unchanged and keep the `admin-nav-count-<label>` test ids.
  - **Remembered state.** Open/closed choices are saved in this browser (`blacq-admin-nav`). On a first visit only To Review is open.
  - **Look.** A black rail as in the mockup: BLACQ + gold List wordmark, role next to it, the current page marked with a gold edge, and "Back to My Account" at the bottom.
  - **Phones (below md).** A black bar sits under the site header. Its Menu button shows the total waiting and opens the same panel in a drawer. The drawer keeps focus inside, and Esc, the backdrop, Close Menu or opening a page closes it.
- **`app/admin/layout.tsx`**: stacks on phones. The rail and the bar pin just below the fixed site header. Wide tables scroll inside the page column instead of the whole page.
- **`app/admin/page.tsx`**: the stat cards sit under a "Waiting for You" heading and now cover every queue in the menu. Added: Pending Reviews, Category Requests, New Feedback, New Tester Notes.

## Tests

- **`tests/admin-nav-groups.test.ts`** (new) checks that:
  - the groups and their items match the founder's list;
  - every `app/admin/<route>/page.tsx` is listed exactly once (19 with Overview);
  - `groupForPath` finds detail pages and doesn't match on a shared prefix;
  - group and total sums are right;
  - unreadable saved state falls back to the defaults;
  - the sidebar source keeps the active group open, shows totals only when closed, and closes the drawer on route change.
- **Existing tests:**
  - `admin-pending-counts`, `problem-reports` and `admin-tester-reflections` now read the hrefs from the nav config.
  - `e2e/admin-entities.spec.ts`: Entities is in Pages & Content, which starts closed. The spec now checks the closed group's total, opens the group, then checks the item pill.

## Verification (local, staging data, 2026-11-21)

- Unit tests: 5510 passed. Typecheck and lint are clean.
- `e2e/admin-entities.spec.ts` passed, as did the axe admin screens and the 098 admin contrast scan.
- A one-off Playwright run (not committed) checked:
  - **1280 and 1024:** the rail, a closed Pages & Content showing 3, and People open and locked on /admin/users.
  - **Remembered choice:** closing To Review survives a reload.
  - **375:** Menu shows 5, the drawer opens, Esc closes it, and opening Claims closes it. No sideways scroll on /admin/claims (it was 496px wide before the layout fix).

## Not in This Ticket

- "This Week" numbers on the overview (in the mockup). They need new queries; a later ticket if wanted.
- The one signed-in shell for members and owners (252) and Business Home + Insights (253).
