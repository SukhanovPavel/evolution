"use client";
import Link from "next/link";
import { ApiError } from "@/lib/api-client";
import { ru } from "@/i18n/ru";
import { Button } from "./ui/Button";
export function QueryState({
  pending,
  error,
  retry,
}: {
  pending: boolean;
  error: Error | null;
  retry: () => void;
}) {
  if (pending) return <p role="status">{ru.loading}</p>;
  if (error instanceof ApiError && error.code === "ONBOARDING_REQUIRED")
    return <Link href="/onboarding">{ru.onboarding} →</Link>;
  if (error instanceof ApiError && error.code === "PROGRAM_COMPLETED")
    return (
      <Link href="/program">
        {ru.programCompleted} — {ru.restart} →
      </Link>
    );
  if (error instanceof ApiError && error.code === "DATABASE_NOT_READY")
    return <p role="alert">{ru.databaseUnavailable}</p>;
  if (error)
    return (
      <div role="alert">
        <p>{ru.error}</p>
        <Button onClick={retry}>{ru.retry}</Button>
      </div>
    );
  return null;
}
