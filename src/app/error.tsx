"use client";
import { ru } from "@/i18n/ru";
import { Button } from "@/components/ui/Button";
import styles from "@/components/App.module.css";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className={styles.auth}>
      <h1>{ru.error}</h1>
      <Button onClick={reset}>{ru.retry}</Button>
    </main>
  );
}
