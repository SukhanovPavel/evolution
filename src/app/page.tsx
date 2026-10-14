import Link from "next/link";
import { Leaf, Footprints, Heart } from "lucide-react";
import { ru } from "@/i18n/ru";
import { Card } from "@/components/ui/Card";
import styles from "@/components/App.module.css";
export default function Page() {
  return (
    <main className={styles.landing}>
      <header className={styles.heading}>
        <Link className={styles.brand} href="/">
          {ru.brand}
        </Link>
        <Link href="/login">{ru.login}</Link>
      </header>
      <div className={styles.hero}>
        <div>
          <p className={styles.tag}>{ru.program}</p>
          <h1>{ru.tagline}</h1>
          <p className={styles.muted}>{ru.intro}</p>
          <div className={styles.links}>
            <Link href="/signup">{ru.start} →</Link>
            {!process.env.NEXT_PUBLIC_SUPABASE_URL && (
              <Link href="/today">{ru.demo}</Link>
            )}
          </div>
        </div>
        <div className={styles.heroArt}>
          <Card>
            <Leaf />
            <h2>{ru.categories.nutrition}</h2>
            <p>{ru.tracks.healthy}</p>
          </Card>
          <Card>
            <Footprints />
            <h2>{ru.categories.activity}</h2>
            <p>{ru.todaySub}</p>
          </Card>
          <Card>
            <Heart />
            <h2>{ru.categories.recovery}</h2>
            <p>{ru.checkinHelp}</p>
          </Card>
        </div>
      </div>
      <p className={styles.muted}>{ru.wellness}</p>
    </main>
  );
}
