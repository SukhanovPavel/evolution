import { spawnSync } from "node:child_process";
const env = {
  ...process.env,
  EVOLUTION_DEMO_TEST: "1",
  EVOLUTION_E2E_MODE: "demo",
  EVOLUTION_E2E_CONNECTED: "0",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
};
for (const args of [
  ["run", "build"],
  ["run", "test:e2e"],
]) {
  const r = spawnSync("npm", args, { env, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
