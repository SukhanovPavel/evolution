import { spawnSync } from "node:child_process";
import { migrationFiles } from "./lib/migrations.mjs";
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
  ...migrationFiles().map((m) => `supabase/migrations/${m.name}`),
  "supabase/seed.sql",
  "tests/rls.sql",
  "tests/push.sql",
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
