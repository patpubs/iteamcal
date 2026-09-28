#!/usr/bin/env bash
# Rebuilds a scratch database from the migrations and runs the permission checks.
# Needs a local Postgres; set PGHOST/PGPORT/PGUSER as usual.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-iteamcal_test}
dropdb --if-exists "$DB"
for role in anon authenticated service_role; do
  psql -q -d postgres -c "drop role if exists $role" >/dev/null 2>&1 || true
done
createdb "$DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/supabase_stub.sql
for f in supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/permissions.sql
