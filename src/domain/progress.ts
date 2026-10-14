import type { Plan } from "./plan";
import type { Checkin } from "./schemas";
import { addDays } from "./dates";
export type HabitEvent = {
  id: string;
  local_date: string;
  category: string;
  event_type: string;
  metadata: { minutes?: number; routine_id?: string };
};
export function progressSummary(
  plans: Plan[],
  checkins: Checkin[],
  events: HabitEvent[],
  from: string,
  to: string,
) {
  const tasks = plans.flatMap((p) => p.daily_tasks);
  const completed = tasks.filter((t) => t.status === "completed");
  const active = new Set([
    ...plans
      .filter((p) => p.daily_tasks.some((t) => t.status === "completed"))
      .map((p) => p.local_date),
    ...events
      .filter((e) => e.event_type === "routine_completed")
      .map((e) => e.local_date),
  ]);
  const routineKeys = new Set(
    events
      .filter((e) => e.event_type === "routine_completed")
      .map((e) => `${e.local_date}:${e.metadata.routine_id}`),
  );
  const taskMinutes = plans.reduce(
    (sum, p) =>
      sum +
      p.daily_tasks
        .filter(
          (t) =>
            t.status === "completed" &&
            ["activity", "stretching"].includes(t.category) &&
            !(
              t.reference_type === "routine" &&
              routineKeys.has(`${p.local_date}:${t.reference_id}`)
            ),
        )
        .reduce((s, t) => s + t.estimated_minutes, 0),
    0,
  );
  const minutes =
    taskMinutes +
    events
      .filter(
        (e) =>
          e.event_type === "routine_completed" &&
          ["activity", "stretching"].includes(e.category),
      )
      .reduce((s, e) => s + Math.max(0, Number(e.metadata.minutes) || 0), 0);
  const weeks = [];
  for (let start = from; start <= to; start = addDays(start, 7)) {
    const end = addDays(start, 6);
    const weekTasks = plans
      .filter((p) => p.local_date >= start && p.local_date <= end)
      .flatMap((p) => p.daily_tasks);
    weeks.push({
      from: start,
      total: weekTasks.length,
      completed: weekTasks.filter((t) => t.status === "completed").length,
      active_days: [...active].filter((d) => d >= start && d <= end).length,
    });
  }
  return {
    completed: completed.length,
    total: tasks.length,
    percent: tasks.length
      ? Math.round((completed.length / tasks.length) * 100)
      : 0,
    active_days: active.size,
    active_minutes: minutes,
    weeks,
    checkins,
    plans,
    achievements: [
      ...(completed.length ? ["firstStep"] : []),
      ...(active.size >= 3 ? ["threeDays"] : []),
    ],
  };
}
export type Progress = ReturnType<typeof progressSummary>;
