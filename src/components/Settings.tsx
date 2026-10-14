"use client";
import { Input } from "./ui/Fields";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Onboarding } from "./Onboarding";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { request, ApiError } from "@/lib/api-client";
import { browserClient, configured } from "@/lib/supabase/browser";
import { demoProfile, demoPreferences } from "@/lib/demo";
import { ru } from "@/i18n/ru";
import styles from "./App.module.css";
export function SettingsView() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  async function exportData() {
    setBusy(true);
    try {
      const value = configured
        ? await request("data/export")
        : { demo: true, profile: demoProfile, preferences: demoPreferences };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(value, null, 2)], {
          type: "application/json",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "evolution-data.json";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage(ru.error);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      if (!configured) {
        setMessage(ru.demoNotice);
        return;
      }
      await request("data/delete", {
        method: "POST",
        body: JSON.stringify({ confirmation }),
      });
      cache.clear();
      router.push("/");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof ApiError &&
          error.code === "ACCOUNT_DELETION_NOT_CONFIGURED"
          ? ru.deleteUnavailable
          : ru.error,
      );
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (configured) await browserClient().auth.signOut();
    cache.clear();
    router.push("/");
    router.refresh();
  }
  return (
    <div className={styles.stack}>
      <Onboarding settings />
      <Card>
        <h2>{ru.privacy}</h2>
        <div className={styles.form}>
          <Button onClick={exportData} disabled={busy}>
            {ru.export}
          </Button>
          <label>
            {ru.deleteConfirm}
            <Input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <Button
            onClick={remove}
            disabled={confirmation !== ru.deleteWord || busy}
          >
            {ru.delete}
          </Button>
          <Button onClick={logout}>{ru.logout}</Button>
          <p role="status">{message}</p>
        </div>
      </Card>
    </div>
  );
}
