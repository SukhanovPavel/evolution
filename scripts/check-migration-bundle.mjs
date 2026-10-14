import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { migrationBundle, migrationFiles } from "./lib/migrations.mjs";
// Dedicated disposable DB on the temporary local test cluster, never a remote Supabase project.
const suiteDb = `evolution_bundle_${Date.now()}`;
const env = { ...process.env, PGHOST: "/private/tmp", PGPORT: "55439" };
function sql(query, db = suiteDb) {
  const r = spawnSync(
    "psql",
    ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-d", db],
    { env, input: query, encoding: "utf8", maxBuffer: 1048576 },
  );
  if (r.status !== 0) throw new Error(r.stderr || "SQL_TEST_FAILED");
  return r.stdout.trim();
}
let created = false;
try {
  sql(`create database ${suiteDb};`, "postgres");
  created = true;
  sql(readFileSync("tests/postgres-bootstrap.sql", "utf8"));
  sql(migrationBundle());
  sql(migrationBundle());
  if (
    Number(
      sql("select count(*) from supabase_migrations.schema_migrations;"),
    ) !== migrationFiles().length
  )
    throw new Error("MIGRATION_HISTORY");
  const ready = JSON.parse(sql("select public.deployment_readiness();"));
  if (!ready.catalog_ready || !ready.rls_ready || !ready.profile_trigger_ready)
    throw new Error("NOT_READY");
  sql(readFileSync("tests/rls.sql", "utf8").replace(/\\[^\n]+/g, ""));
  sql(readFileSync("tests/push.sql", "utf8").replace(/\\[^\n]+/g, ""));
  sql(
    `begin;set local role anon;select public.deployment_readiness();rollback;`,
  );
  console.log(
    "Fresh bootstrap, repeat bootstrap, migration history, catalog counts, readiness and RLS passed.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (created) sql(`drop database ${suiteDb};`, "postgres");
}
