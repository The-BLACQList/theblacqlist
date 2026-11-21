-- Ticket 245: let an account be deleted when the user appears in the audit log.
--
-- admin_audit_log.admin_user_id references auth.users ON DELETE SET NULL, and
-- the audit_log_immutable trigger rejects every UPDATE. SET NULL is an UPDATE,
-- so deleting a user who is the actor on any audit row fails with "Database
-- error deleting user". The Stripe webhook, Pages on Your Plan, location links
-- and the plan cancel on account deletion (ticket 243) all write rows with the
-- owner as actor, so no owner who ever had a plan could delete their account.
--
-- The one change now allowed: the actor goes from a user to NULL, with every
-- other column unchanged. That is exactly what the foreign key does. Any other
-- UPDATE, and every DELETE, is still refused.

CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.admin_user_id IS NOT NULL
     AND NEW.admin_user_id IS NULL
     AND (to_jsonb(NEW) - 'admin_user_id') = (to_jsonb(OLD) - 'admin_user_id')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'admin_audit_log records are immutable. Modification denied.';
  RETURN NULL;
END;
$$;

-- The trigger (audit_log_immutable, BEFORE UPDATE OR DELETE) is unchanged and
-- keeps pointing at this function.
