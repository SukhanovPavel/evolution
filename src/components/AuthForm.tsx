"use client";
import { Input } from "./ui/Fields";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { authSchema, AuthMode } from "@/domain/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { browserClient, configured } from "@/lib/supabase/browser";
import { ru } from "@/i18n/ru";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import styles from "./App.module.css";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(authSchema(mode)),
    defaultValues: { email: "", password: "" },
  });
  async function submit(v: { email: string; password: string }) {
    setBusy(true);
    setMessage("");
    try {
      if (!configured) {
        setMessage(ru.missingConfig);
        return;
      }
      const client = browserClient();
      const redirect = `${location.origin}/auth/callback`;
      const result =
        mode === "login"
          ? await client.auth.signInWithPassword(v)
          : mode === "signup"
            ? await client.auth.signUp({
                ...v,
                options: { emailRedirectTo: redirect },
              })
            : mode === "forgot-password"
              ? await client.auth.resetPasswordForEmail(v.email, {
                  redirectTo: `${redirect}?next=/reset-password`,
                })
              : await client.auth.updateUser({ password: v.password });
      if (result.error) {
        setMessage(
          result.error.code === "invalid_credentials"
            ? ru.authInvalid
            : result.error.code === "email_not_confirmed"
              ? ru.confirmEmail
              : result.error.status === 429
                ? ru.authRateLimit
                : ru.error,
        );
        return;
      }
      if (mode === "forgot-password") setMessage(ru.authSent);
      else if (
        mode === "signup" &&
        "data" in result &&
        (!result.data || !("session" in result.data) || !result.data.session)
      )
        setMessage(ru.confirmEmail);
      else {
        router.replace(mode === "signup" ? "/onboarding" : "/today");
        router.refresh();
      }
    } catch {
      setMessage(ru.error);
    } finally {
      setBusy(false);
    }
  }
  const title =
    mode === "login"
      ? ru.login
      : mode === "signup"
        ? ru.signup
        : mode === "reset-password"
          ? ru.newPassword
          : ru.forgot;
  return (
    <main className={styles.auth}>
      <Link href="/">{ru.brand}</Link>
      <Card>
        <h1>{title}</h1>
        <form onSubmit={handleSubmit(submit)} className={styles.form}>
          {mode !== "reset-password" && (
            <label>
              {ru.email}
              <Input
                type="email"
                autoComplete="email"
                {...register("email")}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <span role="alert">{ru.invalidEmail}</span>}
            </label>
          )}
          {mode !== "forgot-password" && (
            <label>
              {ru.password}
              <Input
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                {...register("password")}
                aria-invalid={Boolean(errors.password)}
              />
              {errors.password && (
                <span role="alert">{ru.passwordMinimum}</span>
              )}
            </label>
          )}
          <Button disabled={busy}>
            {mode === "forgot-password"
              ? ru.reset
              : mode === "reset-password"
                ? ru.savePassword
                : title}
          </Button>
          <p role="status">
            {message ||
              (params.get("error") === "callback" ? ru.authCallbackError : "")}
          </p>
        </form>
        <div className={styles.links}>
          <Link href="/login">{ru.login}</Link>
          <Link href="/signup">{ru.signup}</Link>
          <Link href="/forgot-password">{ru.forgot}</Link>
        </div>
      </Card>
    </main>
  );
}
