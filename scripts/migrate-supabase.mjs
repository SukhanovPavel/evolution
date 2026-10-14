import { postgresEnv } from "./lib/postgres.mjs";
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { migrationBundle, migrationFiles } from "./lib/migrations.mjs";
const bundle = migrationBundle();
if (process.argv.includes("--prepare")) {
  writeFileSync("supabase/bootstrap.sql", bundle);
  console.log(
    `Prepared ${migrationFiles().length} tracked migrations + catalog seed in supabase/bootstrap.sql.`,
  );
  process.exit(0);
}
const token = process.env.SUPABASE_ACCESS_TOKEN,
  db = process.env.SUPABASE_DB_URL;
if (!token && !db) {
  console.error(
    "ADMIN_ACCESS_REQUIRED: set SUPABASE_ACCESS_TOKEN or SUPABASE_DB_URL in .env.local, or use the Supabase integration. Public/service keys do not execute DDL.",
  );
  process.exit(1);
}
try {
  if (token) {
    const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
    const ref = host.split(".")[0];
    if (!/^[a-z0-9]{20}$/.test(ref)) throw new Error("INVALID_PROJECT_REF");
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: bundle }),
        signal: AbortSignal.timeout(120000),
      },
    );
    if (!response.ok) throw new Error(`MANAGEMENT_API_HTTP_${response.status}`);
  } else {
    const result = spawnSync(
      "psql",
      ["-X", "--set", "ON_ERROR_STOP=1", "--quiet", "--no-password"],
      {
        input: bundle,
        encoding: "utf8",
        env: postgresEnv(db),
        maxBuffer: 1048576,
      },
    );
    if (result.error || result.status !== 0)
      throw new Error("POSTGRES_MIGRATION_FAILED");
  }
  console.log(
    `Applied/reconciled ${migrationFiles().length} migrations and idempotent catalog seed. Run npm run supabase:status to verify.`,
  );
} catch (error) {
  console.error(
    error.message.startsWith("MANAGEMENT_API_HTTP_") ||
      error.message === "POSTGRES_MIGRATION_FAILED"
      ? error.message
      : "MIGRATION_CONNECTION_FAILED",
  );
  process.exitCode = 1;
}
