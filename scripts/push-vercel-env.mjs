import { spawnSync } from "node:child_process";
// Only this whitelist is uploaded. Database credentials and Auth admin keys stay local.
for (const name of [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "PUSH_WORKER_SECRET",
]) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  const args = [
    "--yes",
    "vercel@latest",
    "env",
    "add",
    name,
    "production",
    "--yes",
    "--force",
    "--scope",
    "sukhanovpavels-projects",
  ];
  if (!name.startsWith("NEXT_PUBLIC_")) args.push("--sensitive");
  const result = spawnSync("npx", args, {
    input: value + "\n",
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 1048576,
  });
  if (result.status !== 0) {
    console.error(`VERCEL_ENV_SETUP_FAILED: ${name}`);
    process.exit(1);
  }
  console.log(`Configured production variable: ${name} (value hidden).`);
}
