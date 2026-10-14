import type { NextConfig } from "next";
if (
  process.env.VERCEL &&
  (!process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
)
  throw new Error("Vercel deploy requires Supabase URL and publishable key.");
if (
  process.env.VERCEL &&
  (!process.env.NEXT_PUBLIC_APP_URL ||
    new URL(process.env.NEXT_PUBLIC_APP_URL).protocol !== "https:" ||
    ["localhost", "127.0.0.1"].includes(
      new URL(process.env.NEXT_PUBLIC_APP_URL).hostname,
    ))
)
  throw new Error(
    "Vercel deploy requires the HTTPS production NEXT_PUBLIC_APP_URL.",
  );
const config: NextConfig = {
  distDir: process.env.EVOLUTION_DEMO_TEST === "1" ? ".next-demo" : ".next",

  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
