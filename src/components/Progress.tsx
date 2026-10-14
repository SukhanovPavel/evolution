"use client";
import { Input } from "./ui/Fields";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { data } from "@/lib/data";
import { localDate, addDays } from "@/domain/dates";
import { ru } from "@/i18n/ru";
import { Card } from "./ui/Card";
import { QueryState } from "./QueryState";
import styles from "./App.module.css";
export function ProgressView() {
  const [to, setTo] = useState(
    localDate(Intl.DateTimeFormat().resolvedOptions().timeZone),
  );
  const [from, setFrom] = useState(addDays(to, -29));
  const query = useQuery({
    queryKey: ["progress", from, to],
    queryFn: () => data.progress(from, to),
  });
  const p = query.data;
  return (
    <div className={styles.stack}>
      <h1>{ru.progress}</h1>
      <div className={styles.row}>
        <Input
          className={styles.input}
          type="date"
          aria-label={ru.startProgram}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Input
          className={styles.input}
          type="date"
          aria-label={ru.finish}
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => query.refetch()}
      />
      {p && (
        <>
          <div className={styles.grid}>
            {[
              [ru.completion, `${p.percent}%`],
              [ru.activeMinutes, p.active_minutes],
              [ru.activeDays, p.active_days],
            ].map(([title, value]) => (
              <Card key={title}>
                <p className={styles.muted}>{title}</p>
                <p className={styles.stat}>{value}</p>
              </Card>
            ))}
          </div>
          <Card>
            <h2>{ru.completion}</h2>
            <div className={styles.stack}>
              {p.weeks.map((w) => (
                <div key={w.from}>
                  <div className={styles.heading}>
                    <span>{w.from}</span>
                    <span>
                      {w.completed}/{w.total} · {w.active_days}{" "}
                      {ru.activeDays.toLowerCase()}
                    </span>
                  </div>
                  <progress
                    className={styles.progress}
                    max={w.total || 1}
                    value={w.completed}
                  />
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2>{ru.history}</h2>
            {!p.plans.length && <p>{ru.empty}</p>}
            <div className={styles.calendar}>
              {p.plans.map((plan) => (
                <details className={styles.day} key={plan.id}>
                  <summary>
                    {plan.local_date.slice(5)} ·{" "}
                    {
                      plan.daily_tasks.filter((t) => t.status === "completed")
                        .length
                    }
                    /{plan.daily_tasks.length}
                  </summary>
                  {plan.daily_tasks.map((task) => (
                    <p key={task.id}>
                      {task.title}: {ru[task.status]}
                    </p>
                  ))}
                </details>
              ))}
            </div>
          </Card>
          <Card>
            <h2>
              {ru.energy} / {ru.difficulty}
            </h2>
            {!p.checkins.length && <p>{ru.empty}</p>}
            <div className={styles.bars}>
              {p.checkins.map((c) => (
                <div className={styles.bar} key={c.local_date}>
                  <meter
                    min={1}
                    max={5}
                    value={c.energy}
                    aria-label={ru.energy}
                  />
                  <p>
                    {c.energy} / {c.difficulty}
                  </p>
                  <small>{c.local_date?.slice(5)}</small>
                </div>
              ))}
            </div>
          </Card>
          {p.achievements.length > 0 && (
            <Card>
              <h2>{ru.achievements}</h2>
              {p.achievements.map((a) => (
                <p key={a}>{ru[a as "firstStep" | "threeDays"]}</p>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
