"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/lib/api-client";
import { configured } from "@/lib/supabase/browser";
import {
  defaultNotificationSettings,
  notificationSettingsSchema,
  type NotificationSettings,
} from "@/domain/notifications";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input, Select } from "./ui/Fields";
import { ru } from "@/i18n/ru";
import styles from "./App.module.css";
type Status = {
  settings: NotificationSettings;
  configured: boolean;
  publicKey: string | null;
  deviceCount: number;
};
function applicationKey(value: string) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
async function registration() {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("SW_TIMEOUT")), 8000),
    ),
  ]);
}
function subscribeSupport() {
  return () => {};
}
function supportsPush() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    window.isSecureContext
  );
}
export function Notifications() {
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => request<Status>("notifications/settings"),
    enabled: configured,
  });
  const [draft, setDraft] = useState<NotificationSettings | null>(null);
  const values = draft ?? query.data?.settings ?? defaultNotificationSettings;
  const supported = useSyncExternalStore(
    subscribeSupport,
    supportsPush,
    () => false,
  );
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (supportsPush())
      registration()
        .then((r) => r.pushManager.getSubscription())
        .then((s) => setConnected(Boolean(s)))
        .catch(() => {});
  }, []);
  function change<K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K],
  ) {
    setDraft({ ...values, [key]: value });
  }
  async function enable() {
    if (!supported || !query.data?.publicKey) return;
    setBusy(true);
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage(ru.pushPermissionDenied);
        return;
      }
      const r = await registration();
      const sub =
        (await r.pushManager.getSubscription()) ??
        (await r.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationKey(query.data.publicKey),
        }));
      await request("notifications/subscriptions", {
        method: "POST",
        body: JSON.stringify(sub.toJSON()),
      });
      setConnected(true);
      setMessage(ru.pushDeviceEnabled);
      await query.refetch();
    } catch {
      setMessage(ru.pushFailed);
    } finally {
      setBusy(false);
    }
  }
  async function deviceAction(test: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const sub = await (await registration()).pushManager.getSubscription();
      if (!sub) {
        setConnected(false);
        return;
      }
      await request(
        test ? "notifications/test" : "notifications/subscriptions",
        {
          method: test ? "POST" : "DELETE",
          body: JSON.stringify({ endpoint: sub.endpoint }),
        },
      );
      if (!test) {
        await sub.unsubscribe();
        setConnected(false);
        await query.refetch();
      }
      setMessage(test ? ru.pushTestSent : ru.pushDeviceDisabled);
    } catch {
      setMessage(ru.pushFailed);
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const result = notificationSettingsSchema.safeParse(values);
    if (!result.success) {
      setMessage(ru.pushInvalidWindow);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await request("notifications/settings", {
        method: "PUT",
        body: JSON.stringify(result.data),
      });
      await query.refetch();
      setDraft(null);
      setMessage(ru.saved);
    } catch {
      setMessage(ru.pushFailed);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <h2>{ru.pushHeading}</h2>
      <p className={styles.muted}>{ru.pushDescription}</p>
      {!configured ? (
        <p>{ru.demoNotice}</p>
      ) : query.isLoading ? (
        <p>{ru.loading}</p>
      ) : query.isError ? (
        <p role="alert">{ru.error}</p>
      ) : (
        <>
          {!supported && <p className={styles.status}>{ru.pushUnsupported}</p>}
          {!query.data?.configured && (
            <p className={styles.status}>{ru.pushUnavailable}</p>
          )}
          <div className={styles.row}>
            <Button
              onClick={enable}
              disabled={busy || !supported || !query.data?.configured}
            >
              {connected ? ru.pushReconnect : ru.pushEnableDevice}
            </Button>
            {connected && (
              <>
                <Button onClick={() => deviceAction(true)} disabled={busy}>
                  {ru.pushTest}
                </Button>
                <Button onClick={() => deviceAction(false)} disabled={busy}>
                  {ru.pushDisableDevice}
                </Button>
              </>
            )}
          </div>
          <form onSubmit={save} className={styles.form}>
            <label className={styles.checkbox}>
              <Input
                type="checkbox"
                checked={values.enabled}
                onChange={(e) => change("enabled", e.target.checked)}
              />
              {ru.pushEnabled}
            </label>
            <label className={styles.checkbox}>
              <Input
                type="checkbox"
                checked={values.food_enabled}
                onChange={(e) => change("food_enabled", e.target.checked)}
              />
              {ru.pushFoodLabel}
            </label>
            <label>
              {ru.pushFoodTime}
              <Input
                type="time"
                required
                value={values.food_time}
                onChange={(e) => change("food_time", e.target.value)}
              />
            </label>
            <label className={styles.checkbox}>
              <Input
                type="checkbox"
                checked={values.movement_enabled}
                onChange={(e) => change("movement_enabled", e.target.checked)}
              />
              {ru.pushMovementLabel}
            </label>
            <div className={styles.row}>
              <label>
                {ru.pushWorkStart}
                <Input
                  type="time"
                  required
                  value={values.work_start}
                  onChange={(e) => change("work_start", e.target.value)}
                />
              </label>
              <label>
                {ru.pushWorkEnd}
                <Input
                  type="time"
                  required
                  value={values.work_end}
                  onChange={(e) => change("work_end", e.target.value)}
                />
              </label>
              <label>
                {ru.pushInterval}
                <Select
                  value={values.movement_interval}
                  onChange={(e) =>
                    change(
                      "movement_interval",
                      Number(e.target.value) as 30 | 60 | 90 | 120,
                    )
                  }
                >
                  {[30, 60, 90, 120].map((n) => (
                    <option key={n} value={n}>
                      {n} {ru.minutes}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <label className={styles.checkbox}>
              <Input
                type="checkbox"
                checked={values.weekdays_only}
                onChange={(e) => change("weekdays_only", e.target.checked)}
              />
              {ru.pushWeekdays}
            </label>
            <p className={styles.muted}>{ru.pushTimezone}</p>
            <Button disabled={busy || !query.data?.configured}>
              {ru.save}
            </Button>
          </form>
        </>
      )}
      <p role="status">{message}</p>
    </Card>
  );
}
