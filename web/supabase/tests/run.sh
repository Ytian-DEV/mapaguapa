#!/usr/bin/env bash
# Rebuilds a throwaway database on a LOCAL Postgres and applies:
#   Supabase stub -> reconstructed v1 baseline -> seed -> every migration -> *.test.sql
# Usage: PSQL=/path/to/psql PGPORT=54329 bash web/supabase/tests/run.sh
# Never point this at Supabase: it drops and recreates the target database.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
migrations="$here/../migrations"
psql_bin="${PSQL:-psql}"
db="${TEST_DB:-mapaguapa_test}"
export PGOPTIONS="${PGOPTIONS:---client-min-messages=warning}"
conn=(-h "${PGHOST:-127.0.0.1}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}")

case "${PGHOST:-127.0.0.1}" in
  127.0.0.1|localhost|::1) ;;
  *) echo "Refusing to run against non-local host ${PGHOST}" >&2; exit 1 ;;
esac

"$psql_bin" "${conn[@]}" -d postgres -qX -v ON_ERROR_STOP=1 \
  -c "drop database if exists $db with (force)" -c "create database $db"

run() {
  echo "-- $(basename "$1")"
  "$psql_bin" "${conn[@]}" -d "$db" -qX -v ON_ERROR_STOP=1 -o /dev/null -f "$1"
}

run "$here/00_supabase_stub.sql"
run "$here/01_v1_baseline.sql"
run "$here/02_v1_seed.sql"
for file in "$migrations"/*.sql; do run "$file"; done
# Applying twice proves the migrations are re-runnable.
if [ "${SKIP_REAPPLY:-0}" != "1" ]; then
  for file in "$migrations"/*.sql; do run "$file"; done
fi
for file in "$here"/*.test.sql; do
  [ -e "$file" ] || continue
  run "$file"
done
echo "All migrations and tests passed."
