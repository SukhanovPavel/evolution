import { postgresEnv } from "./lib/postgres.mjs";
import { spawnSync } from "node:child_process";
let url;
try {
  url = new URL(process.env.SUPABASE_DB_URL);
} catch {
  console.error("INVALID_DATABASE_URL");
  process.exit(1);
}
if (!["postgresql:", "postgres:"].includes(url.protocol)) {
  console.error("POSTGRESQL_URI_REQUIRED");
  process.exit(1);
}
const r = spawnSync("psql", ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"], {
  input: "select 1;\n",
  encoding: "utf8",
  env: postgresEnv(process.env.SUPABASE_DB_URL),
});
if (r.status === 0) {
  console.log("PostgreSQL connection verified.");
  process.exit(0);
}
const error = r.stderr ?? r.error?.code ?? "";
let detail = error.split("\n").filter(Boolean).slice(0, 2).join(" ");
for (const secret of [
  process.env.SUPABASE_DB_URL,
  url.password,
  decodeURIComponent(url.password),
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.SUPABASE_ACCESS_TOKEN,
].filter(Boolean))
  detail = detail.replaceAll(secret, "[redacted]");
console.error(
  JSON.stringify({
    connected: false,
    reason: /password authentication failed/i.test(error)
      ? "PASSWORD_REJECTED"
      : /translate host|nodename|Network is unreachable|No route/i.test(error)
        ? "HOST_UNREACHABLE"
        : /timed out/i.test(error)
          ? "CONNECTION_TIMEOUT"
          : "CONNECTION_FAILED",
    detail,
  }),
);
process.exitCode = 1;
