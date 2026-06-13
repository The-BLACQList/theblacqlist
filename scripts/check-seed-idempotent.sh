#!/usr/bin/env bash
# K8 — Seed script idempotency check.
# Runs scripts/seed-launch-listings.ts twice against the local Supabase DB and
# asserts the SECOND run inserts nothing and errors nothing
# ("Inserted: 0, ... Errors: 0"). The first run may insert launch listings if
# they aren't present yet — that's expected and idempotent.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "❌ .env.local not found (need Supabase URL + service role key)"; exit 1
fi

# Load local env and map to the names the seed script expects.
set -a
# shellcheck disable=SC1091
source .env.local
set +a
export SUPABASE_URL="${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"; exit 1
fi

echo "▶ First seed run (populate if needed) against $SUPABASE_URL …"
if ! npx tsx scripts/seed-launch-listings.ts > /tmp/seed-run1.log 2>&1; then
  echo "❌ First seed run failed:"; tail -20 /tmp/seed-run1.log; exit 1
fi

echo "▶ Second seed run (idempotency check) …"
if ! npx tsx scripts/seed-launch-listings.ts > /tmp/seed-run2.log 2>&1; then
  echo "❌ Second seed run failed:"; tail -20 /tmp/seed-run2.log; exit 1
fi

echo "--- second run summary ---"
grep "Done —" /tmp/seed-run2.log || true
echo "--------------------------"

fail=0
if grep -Eq "Inserted: [1-9]" /tmp/seed-run2.log; then
  echo "❌ K8 FAIL: second run inserted new rows (not idempotent)"; fail=1
fi
if grep -Eq "Errors: [1-9]" /tmp/seed-run2.log; then
  echo "❌ K8 FAIL: second run reported errors"; fail=1
fi
if ! grep -q "Inserted: 0" /tmp/seed-run2.log; then
  echo "❌ K8 FAIL: no 'Inserted: 0' summary found — did the seed run?"; fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "✅ K8 PASS: second run is idempotent (Inserted: 0, Errors: 0)"
else
  exit 1
fi
