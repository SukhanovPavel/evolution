import { NextResponse } from "next/server";
import { ZodError } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export function ok(data: unknown, status = 200) {
  return NextResponse.json(
    { data },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
export function fail(error: unknown) {
  const status =
    error instanceof HttpError
      ? error.status
      : error instanceof ZodError
        ? 422
        : error instanceof SyntaxError
          ? 400
          : 500;
  const code =
    error instanceof HttpError
      ? error.code
      : error instanceof ZodError
        ? "VALIDATION_ERROR"
        : error instanceof SyntaxError
          ? "INVALID_JSON"
          : "INTERNAL_ERROR";
  return NextResponse.json(
    { error: { code, message: code } },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
export function checked<T>(result: { data: T; error: unknown }): T {
  if (result.error) {
    const error = result.error as { code?: string };
    if (["PGRST205", "PGRST202", "42P01", "42883"].includes(error.code ?? ""))
      throw new HttpError(503, "DATABASE_NOT_READY");
    throw new HttpError(500, "DATABASE_ERROR");
  }
  return result.data;
}
