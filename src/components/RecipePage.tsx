"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { data } from "@/lib/data";
import { ru } from "@/i18n/ru";
import { Card } from "./ui/Card";
import { RecipeDetail } from "./ContentDetail";
import { QueryState } from "./QueryState";
import styles from "./App.module.css";
export function RecipePage({ slug }: { slug: string }) {
  const query = useQuery({
    queryKey: ["recipe", slug],
    queryFn: () => data.recipe(slug),
  });
  return (
    <div className={styles.stack}>
      <Link href="/nutrition">← {ru.nutrition}</Link>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => query.refetch()}
      />
      {query.data && (
        <>
          <h1>{query.data.title}</h1>
          <Card>
            <RecipeDetail recipe={query.data} />
          </Card>
        </>
      )}
    </div>
  );
}
