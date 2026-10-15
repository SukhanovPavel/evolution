import { ru } from "@/i18n/ru";
import type { Preferences, Checkin } from "./schemas";
import type { Recipe, Exercise, Routine, TemplateTask } from "./content";
export type Task = {
  id: string;
  daily_plan_id?: string;
  user_id?: string;
  category: "nutrition" | "activity" | "stretching" | "recovery";
  title: string;
  description: string;
  estimated_minutes: number;
  reference_type: string | null;
  reference_id: string | null;
  template_task_id: string | null;
  sort_order: number;
  status: "pending" | "completed" | "skipped";
  completed_at: string | null;
};
export type Plan = {
  id: string;
  local_date: string;
  timezone: string;
  adaptation_reason: string;
  daily_tasks: Task[];
};
export type Program = {
  id: string;
  start_date: string;
  status: string;
  template_id: string;
  program_templates: { title: string; slug: string; duration_days: number };
  tasks: TemplateTask[];
};
export type Catalog = {
  recipes: Recipe[];
  exercises: Exercise[];
  routines: Routine[];
  routine_exercises: { routine_id: string; exercise_id: string }[];
};
export function safeRecipes(recipes: Recipe[], preferences: Preferences) {
  return recipes.filter(
    (r) =>
      r.active &&
      r.track_tags.includes(preferences.nutrition_track) &&
      !preferences.food_allergies.some((a) =>
        [...r.allergens, ...r.ingredients.map((i) => i.name)].some((v) =>
          v.toLocaleLowerCase("ru").includes(a.toLocaleLowerCase("ru")),
        ),
      ),
  );
}
export function safeExercises(
  exercises: (Exercise | null)[],
  preferences: Preferences,
) {
  return exercises.filter(
    (e): e is Exercise =>
      Boolean(e) &&
      e!.active &&
      (preferences.activity_level === "intermediate" ||
        e!.difficulty === "beginner") &&
      !preferences.excluded_exercises.some(
        (v) =>
          v.toLowerCase() === e!.slug ||
          e!.title.toLowerCase().includes(v.toLowerCase()),
      ) &&
      e!.equipment.every(
        (v) =>
          v === "none" ||
          preferences.equipment.includes(v as Preferences["equipment"][number]),
      ),
  );
}
export function generatePlan(input: {
  preferences: Preferences;
  checkins: Checkin[];
  templates: TemplateTask[];
  day: number;
  catalog: Catalog;
  recentCompletion: number;
}) {
  const { preferences: p, checkins, templates, day, catalog } = input;
  const last = checkins[0];
  const warning = checkins
    .slice(0, 3)
    .some((c) => c.pain_flag || c.illness_flag);
  const low = last && (last.energy <= 2 || last.difficulty >= 4);
  const easy =
    checkins.length >= 3 &&
    checkins
      .slice(0, 3)
      .every(
        (c) =>
          c.energy >= 4 && c.difficulty <= 2 && !c.pain_flag && !c.illness_flag,
      ) &&
    input.recentCompletion >= 0.8;
  const limitations = Boolean(p.limitations.trim());
  const reason = warning
    ? "recovery"
    : limitations
      ? "limitations"
      : low
        ? "low_energy"
        : day % 7 === 0
          ? "rest_day"
          : easy
            ? "gentle_progress"
            : last
              ? "maintain"
              : "initial";
  const recovery = warning || day % 7 === 0 || Boolean(p.limitations.trim());
  const budget = low
    ? Math.max(3, Math.floor(p.time_budget_minutes * 0.6))
    : p.time_budget_minutes;
  const exercises = safeExercises(catalog.exercises, p);
  const allowed = new Set(exercises.map((e) => e.id));
  const routines = catalog.routines.filter(
    (r) =>
      r.active &&
      (p.activity_level === "intermediate" || r.difficulty === "beginner") &&
      catalog.routine_exercises.some((i) => i.routine_id === r.id) &&
      catalog.routine_exercises
        .filter((i) => i.routine_id === r.id)
        .every((i) => allowed.has(i.exercise_id)),
  );
  const recipes = safeRecipes(catalog.recipes, p);
  const source = templates
    .filter((t) => t.day_number === day)
    .sort((a, b) => a.sort_order - b.sort_order);
  const tasks: Omit<Task, "id">[] = [];
  let remaining = budget;
  function add(
    category: Task["category"],
    title: string,
    description: string,
    minutes: number,
    reference_type: string | null = null,
    reference_id: string | null = null,
    template_task_id: string | null = null,
  ) {
    if (minutes > remaining) return;
    remaining -= minutes;
    tasks.push({
      category,
      title,
      description,
      estimated_minutes: minutes,
      reference_type,
      reference_id,
      template_task_id,
      sort_order: tasks.length,
      status: "pending",
      completed_at: null,
    });
  }
  const food = source.find((t) => t.task_type === "nutrition");
  const recipe =
    recipes.find((r) => r.id === food?.payload.reference_id) ??
    recipes[(day - 1) % Math.max(1, recipes.length)];
  add(
    "nutrition",
    p.food_allergies.length
      ? ru.allergyHabit
      : (food?.payload.title ?? ru.plan.habitTitle),
    food?.payload.description ?? ru.plan.habitDescription,
    0,
    recipe ? "recipe" : null,
    recipe?.id ?? null,
    food?.id ?? null,
  );
  // Reserve time for stretching and recovery. A routine is only assigned at its actual duration.
  if (recovery)
    add("recovery", ru.plan.recoveryTitle, ru.plan.recoveryDescription, 1);
  else {
    const maximum = Math.max(1, remaining - 2);
    // Alternate training and lighter movement; walking is one part of a mixed program.
    const walkingDay = !low && p.goals.includes("walking") && day % 3 === 0;
    const preferred =
      p.goals.includes("flexibility") && day % 2 === 0
        ? "stretching"
        : "activity";
    const baseline = p.activity_level === "intermediate" ? 12 : 6;
    const target = low ? 2 : easy ? Math.min(maximum, baseline + 1) : baseline;
    const candidates = routines.filter(
      (r) =>
        r.category === preferred &&
        r.estimated_minutes <= maximum &&
        r.estimated_minutes <= target,
    );
    const strengthDay = preferred === "activity" && day % 2 === 1;
    const ranked = candidates.sort((a, b) => {
      const priority = (r: Routine) =>
        r.slug.startsWith("strength-") === strengthDay ? 0 : 1;
      return (
        priority(a) - priority(b) ||
        Math.abs(a.estimated_minutes - target) -
          Math.abs(b.estimated_minutes - target) ||
        a.id.localeCompare(b.id)
      );
    });
    const best = ranked[0];
    const similar = ranked.filter(
      (r) =>
        best &&
        (strengthDay && r.slug.startsWith("strength-")) ===
          (strengthDay && best.slug.startsWith("strength-")) &&
        r.estimated_minutes === best.estimated_minutes,
    );
    const routine = !walkingDay
      ? similar[(day - 1) % Math.max(1, similar.length)]
      : undefined;
    const fallback = exercises.filter((e) => e.category === preferred);
    const exercise = walkingDay
      ? exercises.find((e) => e.slug === "walk")
      : low
        ? exercises.find((e) => e.slug === "march")
        : fallback[(day - 1) % Math.max(1, fallback.length)];
    const template = source.find((t) => t.task_type === "activity");
    if (routine)
      add(
        preferred,
        routine.title,
        ru.plan.movementDescription,
        routine.estimated_minutes,
        "routine",
        routine.id,
        template?.id ?? null,
      );
    else if (exercise)
      add(
        "activity",
        exercise.title,
        exercise.description,
        exercise.slug === "walk"
          ? Math.min(maximum, low ? 1 : easy ? 4 : 3)
          : 1,
        "exercise",
        exercise.id,
        template?.id ?? null,
      );
    else
      add(
        "recovery",
        ru.plan.noMovementTitle,
        ru.plan.noMovementDescription,
        1,
      );
  }
  const stretches = exercises.filter((e) => e.category === "stretching");
  const stretch = stretches[(day - 1) % Math.max(1, stretches.length)];
  if (!warning && stretch)
    add(
      "stretching",
      stretch.title,
      stretch.description,
      1,
      "exercise",
      stretch.id,
      source.find((t) => t.task_type === "stretching")?.id ?? null,
    );
  else add("recovery", ru.plan.bodyCheckTitle, ru.plan.bodyCheckDescription, 1);
  add("recovery", ru.plan.pauseTitle, ru.plan.pauseDescription, 1);
  if (easy && !recovery && p.cold_opt_in && p.cold_safety_ack)
    add("recovery", ru.plan.coldTitle, ru.plan.coldDescription, 0);
  return { adaptation_reason: reason, tasks };
}

/** Preview uses the same selection rules; check-ins can change the actual daily plan. */
export function previewProgram(input: {
  preferences: Preferences;
  templates: TemplateTask[];
  catalog: Catalog;
}): TemplateTask[] {
  return Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    return generatePlan({
      ...input,
      day,
      checkins: [],
      recentCompletion: 0,
    }).tasks.map((t) => ({
      id: `preview-${day}-${t.sort_order}`,
      program_template_id: input.templates[0]?.program_template_id ?? "",
      day_number: day,
      task_type: t.category,
      payload: {
        title: t.title,
        description: t.description,
        reference_type:
          t.reference_type as TemplateTask["payload"]["reference_type"],
        reference_id: t.reference_id,
      },
      estimated_minutes: t.estimated_minutes,
      sort_order: t.sort_order,
    }));
  }).flat();
}
