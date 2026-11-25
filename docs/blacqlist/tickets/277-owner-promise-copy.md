# Ticket 277: Free Owner Promises

**Status:** Merged #410, 2026-11-24.

## Why

Two lines that reach owners on the Free plan promised Starter features. The founder approved both fixes on 2026-11-24.

## What Changed

| Where | Before | After |
| --- | --- | --- |
| Approval email (`lib/email/templates/entity-approved.tsx`) | You can update your details, add photos, and respond to reviews any time from your dashboard. | You can update your details and add photos any time from your dashboard. |
| My Account, "Claim your page. It's free." box (`app/account/(overview)/page.tsx`) | Keep your hours and story right, answer reviews, and see who finds you. | Keep your hours, story and photos right. |

Review replies (`review_response`) and analytics (`analytics`) both need Starter and up (`lib/stripe/features.ts`).

## Checks

- `tests/for-business-copy.test.ts` pins both lines against `lib/stripe/features.ts`.
