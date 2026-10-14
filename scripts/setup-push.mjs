import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import webpush from "web-push";
import { postgresEnv } from "./lib/postgres.mjs";
const literal = (v) => `'${v.replaceAll("'", "''")}'`;
if (process.argv.includes("--generate")) {
  const file = ".env.local";
  let content = readFileSync(file, "utf8");
  const keys = webpush.generateVAPIDKeys();
  const values = {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY:
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || keys.publicKey,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || keys.privateKey,
    PUSH_WORKER_SECRET:
      process.env.PUSH_WORKER_SECRET || randomBytes(32).toString("base64url"),
    NEXT_PUBLIC_APP_URL:
      process.argv[process.argv.indexOf("--app-url") + 1] ||
      process.env.NEXT_PUBLIC_APP_URL,
  };
  // --app-url is required to avoid accidentally treating argv[0] as a URL.
  if (!process.argv.includes("--app-url")) delete values.NEXT_PUBLIC_APP_URL;
  for (const [name, value] of Object.entries(values)) {
    if (!value) continue;
    const pattern = new RegExp(`^${name}=.*$`, "m");
    content = pattern.test(content)
      ? content.replace(pattern, `${name}=${value}`)
      : `${content.trimEnd()}\n${name}=${value}\n`;
  }
  writeFileSync(file, content, { mode: 0o600 });
  console.log(
    "Push keys generated/preserved in private .env.local. No secrets printed.",
  );
  process.exit(0);
}
const secret = process.env.PUSH_WORKER_SECRET;
const origin = new URL(process.env.NEXT_PUBLIC_APP_URL).origin;
if (
  !secret ||
  secret.length < 32 ||
  !process.env.SUPABASE_DB_URL ||
  !origin.startsWith("https://")
)
  throw new Error("PUSH_SETUP_ENV_REQUIRED");
const hash = createHash("sha256").update(secret).digest("hex");
const sql = `begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault;
insert into evolution_private.push_worker_config(singleton,secret_hash) values(true,${literal(hash)}) on conflict(singleton) do update set secret_hash=excluded.secret_hash;
do $setup$ declare sid uuid; begin
 select id into sid from vault.secrets where name='evolution_push_worker';
 if sid is null then perform vault.create_secret(${literal(secret)},'evolution_push_worker','Evolution push scheduler credential');
 else perform vault.update_secret(sid,${literal(secret)},'evolution_push_worker','Evolution push scheduler credential');end if;
end $setup$;
select cron.schedule('evolution-push','*/5 * * * *',$job$
 select net.http_post(url:=${literal(origin + "/api/v1/notifications/dispatch")}, headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='evolution_push_worker')),body:='{}'::jsonb,timeout_milliseconds:=60000);
$job$);
commit;`;
const result = spawnSync(
  "psql",
  ["-X", "--no-password", "-q", "-v", "ON_ERROR_STOP=1"],
  {
    input: sql,
    encoding: "utf8",
    env: postgresEnv(process.env.SUPABASE_DB_URL),
  },
);
if (result.status !== 0) {
  console.error("PUSH_SCHEDULER_SETUP_FAILED");
  process.exit(1);
}
console.log(
  "Push worker credential stored privately; Supabase Cron configured every 5 minutes.",
);
