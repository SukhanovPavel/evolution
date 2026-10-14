"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Map,
  Leaf,
  Dumbbell,
  ChartNoAxesCombined,
  MessageCircle,
  Settings,
  Shield,
} from "lucide-react";
import { configured } from "@/lib/supabase/browser";
import { api, ApiError } from "@/lib/api-client";
import { ru } from "@/i18n/ru";
import styles from "./App.module.css";
const icons = {
  today: CalendarDays,
  program: Map,
  nutrition: Leaf,
  movement: Dumbbell,
  progress: ChartNoAxesCombined,
  coach: MessageCircle,
  settings: Settings,
  admin: Shield,
};
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [offline, setOffline] = useState(false);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    enabled: configured,
    retry: false,
  });
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401)
      location.replace("/login");
  }, [me.error]);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        {ru.skipNavigation}
      </a>
      <aside className={styles.sidebar}>
        <Link href="/today" className={styles.brand}>
          {ru.brand}
          <span aria-hidden> ↗</span>
        </Link>
        <nav className={styles.nav} aria-label={ru.brand}>
          {Object.entries(ru.nav)
            .filter(([key]) => key !== "admin" || me.data?.role === "admin")
            .map(([key, label]) => {
              const Icon = icons[key as keyof typeof icons];
              return (
                <Link
                  key={key}
                  href={`/${key}`}
                  className={
                    pathname.startsWith(`/${key}`) ? styles.selected : ""
                  }
                  aria-current={
                    pathname.startsWith(`/${key}`) ? "page" : undefined
                  }
                >
                  <Icon size={22} />
                  {label}
                </Link>
              );
            })}
        </nav>
        <p className={styles.muted}>{ru.tagline}</p>
      </aside>
      <main id="main-content" className={styles.content}>
        {!configured && <div className={styles.banner}>{ru.demoNotice}</div>}
        {offline && (
          <div className={styles.offline} role="status">
            {ru.offline}
          </div>
        )}
        {configured && me.isPending ? (
          <p>{ru.loading}</p>
        ) : configured && me.error ? (
          <p role="alert">
            {me.error instanceof ApiError &&
            me.error.code === "DATABASE_NOT_READY"
              ? ru.databaseUnavailable
              : ru.error}
          </p>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
