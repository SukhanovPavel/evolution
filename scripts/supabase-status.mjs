import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Supabase public configuration is missing.");
  process.exit(1);
}
try {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
    },
  });
  const [settings, db] = await Promise.all([
    fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(15000),
    }),
    client.rpc("deployment_readiness"),
  ]);
  const body = await settings.json();
  console.log(
    JSON.stringify({
      auth: {
        status: settings.status,
        emailEnabled: body.external?.email,
        confirmEmail: body.mailer_autoconfirm === false,
      },
    }),
  );
  console.log(
    JSON.stringify({
      database: {
        status: db.status,
        errorCode: db.error?.code ?? null,
        readiness: db.data ?? null,
      },
      accountDeletionConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    }),
  );
  if (
    !settings.ok ||
    db.error ||
    !db.data?.catalog_ready ||
    !db.data?.rls_ready ||
    !db.data?.profile_trigger_ready
  )
    process.exitCode = 1;
} catch (error) {
  console.error(
    JSON.stringify({
      connection: "failed",
      reason: error.cause?.code ?? error.code ?? error.name,
    }),
  );
  process.exitCode = 1;
}
