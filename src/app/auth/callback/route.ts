import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const recovery =
    request.nextUrl.searchParams.get("next") === "/reset-password";
  if (code) {
    const client = await serverClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(recovery ? "/reset-password" : "/today", request.url),
      );
  }
  return NextResponse.redirect(new URL("/login?error=callback", request.url));
}
