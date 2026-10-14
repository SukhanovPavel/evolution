import { readiness } from "@/lib/readiness";
import { ok } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  const result = await readiness();
  return ok(result, result.ready ? 200 : 503);
}
