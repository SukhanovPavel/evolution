"use client";
import { useQuery } from "@tanstack/react-query";
import { data } from "@/lib/data";
import { ru } from "@/i18n/ru";
import { Card } from "./ui/Card";
import styles from "./App.module.css";
export function Coach() {
  const plan = useQuery({ queryKey: ["plan"], queryFn: () => data.plan() });
  const reason = plan.data?.adaptation_reason;
  return (
    <div className={styles.stack}>
      <h1>{ru.coach}</h1>
      <p className={styles.muted}>{ru.coachIntro}</p>
      <Card>
        <h2>
          {reason ? ru.reasons[reason as keyof typeof ru.reasons] : ru.todaySub}
        </h2>
        <p>
          {reason === "recovery"
            ? ru.wellness
            : reason === "low_energy"
              ? ru.todaySub
              : ru.checkinHelp}
        </p>
      </Card>
      <Card>
        <h2>{ru.nutrition}</h2>
        <p>{ru.nutritionSafety}</p>
      </Card>
      <Card>
        <h2>{ru.faq}</h2>
        {ru.faqItems.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </Card>
    </div>
  );
}
