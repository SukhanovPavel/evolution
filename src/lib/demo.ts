import { defaults, Profile, Preferences, Checkin } from "@/domain/schemas";
import {
  content,
  Recipe,
  Exercise,
  TemplateTask,
  Routine,
} from "@/domain/content";
import { generatePlan, Plan, Task, Program } from "@/domain/plan";
import { localDate, dayNumber } from "@/domain/dates";
import { progressSummary, HabitEvent } from "@/domain/progress";
export let demoProfile: Profile = {
  display_name: "",
  timezone: "Europe/Moscow",
  age_range: "",
};
export let demoPreferences: Preferences = { ...defaults };
export function setDemoPreferences(profile: Profile, preferences: Preferences) {
  demoProfile = profile;
  demoPreferences = preferences;
}
const plans = new Map<string, Plan>();
const checkins = new Map<string, Checkin>();
const events: HabitEvent[] = [];
export const demoFavorites = new Set<string>();
export function demoProgram(): Program {
  const template = content.program_templates.find(
    (t) => t.category === demoPreferences.nutrition_track,
  )!;
  return {
    id: "demo-program",
    start_date: localDate(demoProfile.timezone),
    status: "active",
    template_id: template.id,
    program_templates: template,
    tasks: content.program_template_tasks.filter(
      (t) => t.program_template_id === template.id,
    ) as TemplateTask[],
  };
}
export function demoPlan(date = localDate(demoProfile.timezone)): Plan {
  if (plans.has(date)) return plans.get(date)!;
  const program = demoProgram();
  const result = generatePlan({
    preferences: demoPreferences,
    checkins: [...checkins.values()]
      .filter((c) => c.local_date! < date)
      .reverse(),
    templates: program.tasks,
    day: dayNumber(program.start_date, date),
    catalog: content as unknown as Parameters<
      typeof generatePlan
    >[0]["catalog"],
    recentCompletion: 0,
  });
  const plan = {
    id: `demo-${date}`,
    local_date: date,
    timezone: demoProfile.timezone,
    adaptation_reason: result.adaptation_reason,
    daily_tasks: result.tasks.map((t, i) => ({
      ...t,
      id: `demo-${date}-${i}`,
    })),
  };
  plans.set(date, plan);
  return plan;
}
export function demoTask(id: string, status: Task["status"]) {
  for (const plan of plans.values()) {
    const task = plan.daily_tasks.find((t) => t.id === id);
    if (task) {
      task.status = status;
      task.completed_at =
        status === "completed" ? new Date().toISOString() : null;
      return task;
    }
  }
  throw new Error("NOT_FOUND");
}
export function demoCheckin(date: string, value: Checkin) {
  checkins.set(date, { ...value, local_date: date });
}
export function demoProgress(from: string, to: string) {
  return progressSummary(
    [...plans.values()].filter(
      (p) => p.local_date >= from && p.local_date <= to,
    ),
    [...checkins.values()],
    events,
    from,
    to,
  );
}
export function demoRoutine(slug: string): Routine {
  const r = content.routines.find((r) => r.slug === slug);
  if (!r) throw new Error("NOT_FOUND");
  return {
    ...r,
    routine_exercises: content.routine_exercises
      .filter((i) => i.routine_id === r.id)
      .map((i) => ({
        ...i,
        exercises: content.exercises.find(
          (e) => e.id === i.exercise_id,
        )! as Exercise,
      })),
  };
}
export function demoSession(routine_id: string, minutes: number) {
  events.push({
    id: crypto.randomUUID(),
    local_date: localDate(demoProfile.timezone),
    category: "activity",
    event_type: "routine_completed",
    metadata: { routine_id, minutes },
  });
}
export const demoRecipes = content.recipes as Recipe[];

export function demoCheckins(from: string, to: string) {
  return [...checkins.values()].filter(
    (c) => c.local_date! >= from && c.local_date! <= to,
  );
}
