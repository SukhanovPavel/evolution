import "server-only";
import { createClient } from "@supabase/supabase-js";
export async function readiness() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const accountDeletionConfigured = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  if (!url || !key)
    return {
      ready: false,
      checks: { configured: false, accountDeletionConfigured },
    };
  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: AbortSignal.timeout(8000),
            cache: "no-store",
          }),
      },
    });
    const [db, auth] = await Promise.all([
      client.rpc("deployment_readiness"),
      fetch(`${url}/auth/v1/settings`, {
        headers: { apikey: key },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      }),
    ]);
    const value = db.data as {
      schema_version?: number;
      catalog_ready?: boolean;
      rls_ready?: boolean;
      profile_trigger_ready?: boolean;
    } | null;
    const checks = {
      configured: true,
      auth: auth.ok,
      schema: !db.error && (value?.schema_version ?? 0) >= 5,
      catalog: !!value?.catalog_ready,
      rls: !!value?.rls_ready,
      profileTrigger: !!value?.profile_trigger_ready,
      accountDeletionConfigured,
    };
    return {
      ready:
        checks.auth &&
        checks.schema &&
        checks.catalog &&
        checks.rls &&
        checks.profileTrigger,
      checks,
    };
  } catch {
    return {
      ready: false,
      checks: {
        configured: true,
        connection: false,
        accountDeletionConfigured,
      },
    };
  }
}
