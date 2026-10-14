import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { postgresEnv } from "./lib/postgres.mjs";
if (!process.env.SUPABASE_DB_URL) {
  console.error("SUPABASE_DB_URL_REQUIRED");
  process.exit(1);
}
let sql = readFileSync("tests/rls.sql", "utf8") + "\n" + readFileSync("tests/push.sql", "utf8");
for (const old of [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
])
  sql = sql.replaceAll(old, randomUUID());
sql = sql.replace(
  /(select set_config\('request.jwt.claim.sub','([^']+)',true\);)/g,
  (_, statement, id) =>
    `${statement}\nselect set_config('request.jwt.claims',json_build_object('sub','${id}','role','authenticated')::text,true);`,
);
const r = spawnSync(
  "psql",
  ["-X", "-q", "--no-password", "-v", "ON_ERROR_STOP=1"],
  {
    input: sql,
    encoding: "utf8",
    env: postgresEnv(process.env.SUPABASE_DB_URL),
    maxBuffer: 1048576,
  },
);
if (r.status !== 0) {
  console.error("CLOUD_RLS_TEST_FAILED");
  const line = (r.stderr ?? "").split("\n").find((v) => v.includes("ERROR:"));
  if (line)
    console.error(line.replaceAll(process.env.SUPABASE_DB_URL, "[redacted]"));
  process.exit(1);
}
console.log(
  "Cloud RLS, ownership, role protection, plan idempotency and preference transactions passed. All test writes rolled back.",
);
