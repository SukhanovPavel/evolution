import { it, expect } from "vitest";
import { postgresEnv } from "../scripts/lib/postgres.mjs";
it("splits PostgreSQL URI into libpq variables without putting URI in PGDATABASE", () => {
  const env = postgresEnv(
    "postgresql://postgres.project:secret%40value@db.example.test:6543/postgres?sslmode=require",
    {},
  );
  expect(env.PGHOST).toBe("db.example.test");
  expect(env.PGPORT).toBe("6543");
  expect(env.PGUSER).toBe("postgres.project");
  expect(env.PGPASSWORD).toBe("secret@value");
  expect(env.PGDATABASE).toBe("postgres");
});
it("rejects HTTPS API URLs and insecure remote database connections", () => {
  expect(() => postgresEnv("https://example.supabase.co", {})).toThrow(
    "POSTGRESQL_URI_REQUIRED",
  );
  expect(() =>
    postgresEnv(
      "postgresql://postgres:p@db.example.test/postgres?sslmode=disable",
      {},
    ),
  ).toThrow("DATABASE_SSL_REQUIRED");
});
it("supports local Unix socket test connections", () => {
  const env = postgresEnv(
    "postgresql:///postgres?host=/private/tmp&port=55439",
    {},
  );
  expect(env.PGHOST).toBe("/private/tmp");
  expect(env.PGPORT).toBe("55439");
  expect(env.PGDATABASE).toBe("postgres");
});
