import { spawnSync } from "node:child_process";
// Only for a fresh disposable database. Never point at a real Supabase database.
const db = process.env.EVOLUTION_TEST_DATABASE_URL;
if (!db) {
  console.error(
    "Set EVOLUTION_TEST_DATABASE_URL to a disposable, empty PostgreSQL database.",
  );
  process.exit(1);
}
for (const file of [
  "tests/postgres-bootstrap.sql",
  "supabase/migrations/202610140001_initial.sql",
  "supabase/migrations/202610140002_admin_templates.sql",
  "supabase/migrations/202610140003_preferences.sql",
  "supabase/migrations/202610140004_assigned_templates.sql",
  "supabase/migrations/202610140005_deployment_readiness.sql",
  "supabase/seed.sql",
  "tests/rls.sql",
]) {
  const result = spawnSync("psql", [db, "-v", "ON_ERROR_STOP=1", "-f", file], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stderr);
    process.exit(1);
  }
  console.log(`${file}: passed`);
}
