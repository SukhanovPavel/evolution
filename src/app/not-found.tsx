import Link from "next/link";
import { ru } from "@/i18n/ru";
import styles from "@/components/App.module.css";
export default function Page() {
  return (
    <main className={styles.auth}>
      <h1>{ru.notFound}</h1>
      <Link href="/">{ru.home}</Link>
    </main>
  );
}
