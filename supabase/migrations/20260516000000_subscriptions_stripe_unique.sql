-- Add unique constraint on stripe_subscription_id so the webhook handler can
-- safely upsert subscription rows without creating duplicates.
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_stripe_subscription_id_key
  UNIQUE (stripe_subscription_id);
