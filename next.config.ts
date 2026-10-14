import type { NextConfig } from "next";
if (
  process.env.VERCEL &&
  (!process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
)
  throw new Error("Vercel deploy requires Supabase URL and publishable key.");
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
