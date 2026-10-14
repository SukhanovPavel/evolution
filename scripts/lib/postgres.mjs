/**
 * @param {string} value
 * @param {Record<string, string | undefined>} base
 * @returns {Record<string, string | undefined>}
 */
export function postgresEnv(value, base = process.env) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("INVALID_DATABASE_URL");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("POSTGRESQL_URI_REQUIRED");
  const query = url.searchParams;
  const host = query.get("host") ?? url.hostname.replace(/^\[|\]$/g, "");
  const local =
    !host ||
    host.startsWith("/") ||
    ["localhost", "127.0.0.1", "::1"].includes(host);
  const ssl = query.get("sslmode") ?? (local ? "prefer" : "require");
  if (!local && !["require", "verify-ca", "verify-full"].includes(ssl))
    throw new Error("DATABASE_SSL_REQUIRED");
  const env = {
    ...base,
    PGDATABASE:
      query.get("dbname") ??
      (decodeURIComponent(url.pathname.slice(1)) || "postgres"),
    PGPORT: query.get("port") ?? (url.port || "5432"),
    PGSSLMODE: ssl,
    PGCONNECT_TIMEOUT: query.get("connect_timeout") ?? "10",
  };
  if (host) env.PGHOST = host;
  if (url.username || query.has("user"))
    env.PGUSER = query.get("user") ?? decodeURIComponent(url.username);
  if (url.password) env.PGPASSWORD = decodeURIComponent(url.password);
  return env;
}
