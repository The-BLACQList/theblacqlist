# Ticket 245: Owners Can Delete Their Account Again

**Status:** Merged #370 (06f5d9b), 2026-11-21. Migration applied through the Management API on staging, then prod (dry run first on each), and verified on both.

## Why

Found in the ticket 243 Stripe test-mode run (2026-11-21, staging). The plan was cancelled and the pages went to Free, then the account delete failed: "We could not delete your account right now." The server log showed `auth.admin.deleteUser` → "Database error deleting user".

Cause:
- `admin_audit_log.admin_user_id` references `auth.users` with `ON DELETE SET NULL`.
- The `audit_log_immutable` trigger (first migration) rejects every UPDATE on `admin_audit_log`.
- SET NULL is an UPDATE, so the trigger rejects it, and the whole user delete rolls back.

Who's affected: anyone who is the actor on an audit row. The Stripe webhook (`subscription_synced`, `subscription_canceled`, `subscription_payment_failed`, …), Pages on Your Plan, location links, admin actions, and from ticket 243 the cancel on deletion all write the user as actor. In practice no owner who ever had a plan could delete their account, in prod as well. That breaks the Privacy Policy's deletion promise, and Terms 13.9 together with 243.

## What Changed

- Migration `20261202000000_audit_log_actor_on_user_delete.sql` replaces `prevent_audit_log_modification()`. It allows one UPDATE: the actor going from a user to NULL with every other column unchanged (compared as JSON, so a column added later is covered too). That is exactly what the foreign key does. Every other UPDATE and every DELETE is still refused. The trigger itself is unchanged.
- The audit rows stay. They lose the link to the deleted person, which is what SET NULL was chosen for.

## Tests

- `tests/audit-log-user-delete.test.ts`: the FK still sets null; the trigger allows only actor → NULL with the rest unchanged; everything else is still refused.

## Local Postgres Check (2026-11-21)

Throwaway Postgres 14 with `auth.users`, `admin_audit_log` and the original trigger, copied from the first migration:
- **Before the fix:** deleting a user with audit rows fails with "admin_audit_log records are immutable", raised from the FK's `UPDATE … SET "admin_user_id" = NULL`. The user stays.
- **After the fix:** the user is deleted and their rows stay with a null actor. Still refused: changing `action`, setting the actor to null while changing another column, and deleting a row.

A service-role `UPDATE` that only nulls an actor is now allowed too. That is the same change the FK makes, and the service role could already drop the trigger.

## Verify After Applying

1. Staging: delete the 243 test owner (`plans238-test@test.local`) from Settings. Expect a redirect to `/sign-in?deleted=1`, the auth user gone, and their audit rows kept with a null actor.
2. Staging: a direct `UPDATE admin_audit_log SET action = 'x'` is still refused.
3. Prod: apply after staging passes.

## Applied (2026-11-21)

| Check | Staging | Prod |
|---|---|---|
| Dry run in a transaction, aborted on purpose | Actor → NULL allowed; other UPDATE and DELETE refused; nothing kept | Same |
| Applied | 201 | 201 |
| Function has the fix | Yes | Yes |
| Settings delete of the 243 test owner | `/sign-in?deleted=1`; auth user gone; pages Free with no owner; 20 audit rows kept with a null actor | Not run (no test owner in prod) |

Prod deploy of 06f5d9b succeeded with no error logs after it. The staging test owner's pages were deleted afterwards.
