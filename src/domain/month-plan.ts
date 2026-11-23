import { ru } from "@/i18n/ru";
import { safeExercises, safeRecipes, type Catalog } from "./plan";
import type { Preferences } from "./schemas";

type Session = "strength" | "cardio" | "mobility" | "rest";
const weeks: Record<string, readonly Session[]> = {
  fat_loss: [
    "strength",
    "cardio",
    "mobility",
    "strength",
    "cardio",
    "cardio",
    "rest",
  ],
  muscle: [
    "strength",
    "mobility",
    "strength",
    "cardio",
    "strength",
    "mobility",
    "rest",
  ],
  fitness: [
    "strength",
    "cardio",
    "mobility",
    "strength",
    "cardio",
    "mobility",
    "rest",
  ],
};
const strength = [
  ["squat", "wall-push", "bridge", "prone-row", "dead-bug"],
  ["hip-hinge", "knee-push", "prone-row", "bird-dog", "heel-raise"],
  ["reverse-lunge", "wall-push", "bridge", "prone-row", "wall-plank"],
];

function focus(preferences: Preferences) {
  return (
    preferences.goals.find((g) => g === "fat_loss" || g === "muscle") ??
    "fitness"
  );
}

export function monthSession(
  preferences: Preferences,
  catalog: Catalog,
  day: number,
  cycle: number,
  needsRest: boolean,
  tired: boolean,
  readyToProgress: boolean,
  budget: number,
) {
  const goal = focus(preferences);
  const week = Math.floor((day - 1) / 7);
  let kind = needsRest || day === 30 ? "rest" : weeks[goal][(day - 1) % 7];
  if (tired && kind !== "rest") kind = "mobility";
  const exercises = safeExercises(catalog.exercises, preferences);
  const level = preferences.activity_level;
  const targets = {
    beginner: [10, 14],
    intermediate: [16, 22],
    advanced: [22, 32],
  };
  const workMinutes = Math.min(
    budget,
    targets[level][kind === "cardio" ? 1 : 0],
  );
  const minutes =
    kind === "mobility" ? Math.min(workMinutes, tired ? 5 : 10) : workMinutes;
  const variants = strength[(day + week + cycle - 2) % strength.length];
  const slugs =
    kind === "strength"
      ? variants.map((slug) => {
          if (
            slug === "prone-row" &&
            exercises.some((e) => e.slug === "band-row")
          )
            return "band-row";
          if (
            level === "advanced" &&
            (slug === "knee-push" || slug === "wall-push") &&
            exercises.some((e) => e.slug === "floor-push")
          )
            return "floor-push";
          if (level === "beginner")
            return (
              {
                squat: "chair-squat",
                "knee-push": "wall-push",
                "reverse-lunge": "squat",
              }[slug] ?? slug
            );
          return slug;
        })
      : kind === "cardio"
        ? ["march", "side-step", "toe-tap"]
        : kind === "mobility"
          ? ["shoulder-roll", "chest-open", "side-reach", "ankle-circle"]
          : [];
  const moves = slugs.flatMap((slug) =>
    exercises.filter((e) => e.slug === slug),
  );
  if (kind === "rest" || moves.length === 0)
    return { category: "recovery" as const, ...ru.month.rest, minutes: 1 };

  const warmup = Math.min(3, Math.floor(minutes / 4));
  const rounds =
    kind === "strength"
      ? Math.min(
          level === "advanced" && week !== 3 ? 3 : level !== "beginner" ? 2 : 1,
          Math.max(1, Math.floor((minutes - warmup * 2) / moves.length)),
        )
      : 1;
  const reps =
    (level === "beginner" ? 6 : 8) +
    (readyToProgress && (week === 1 || week === 2) ? 2 : 0);
  const intervals = kind === "cardio" ? Math.max(1, minutes - warmup * 2) : 0;
  const lines = [
    ru.month.warmup(warmup, moves[0].title),
    kind === "strength"
      ? ru.month.strengthGuide(rounds, reps, level === "advanced")
      : kind === "cardio"
        ? ru.month.cardioGuide(intervals)
        : ru.month.mobilityGuide,
    ...moves.map(
      (e) => `• ${e.title}. ${e.instructions.join(". ")}. ${e.easier}`,
    ),
    ru.month.cooldown(warmup),
    ru.month.stop,
  ];
  return {
    category:
      kind === "mobility" ? ("stretching" as const) : ("activity" as const),
    title: ru.month.sessions[kind],
    description: lines.join("\n"),
    minutes,
  };
}

const breakfasts = ["recipe-1", "recipe-15", "recipe-9"];
const lunches = [
  "recipe-3",
  "recipe-4",
  "recipe-16",
  "recipe-5",
  "recipe-10",
  "recipe-11",
  "recipe-13",
];
const dinners = [
  "recipe-6",
  "recipe-14",
  "recipe-2",
  "recipe-5",
  "recipe-8",
  "recipe-4",
  "recipe-16",
];

export function monthMenu(
  preferences: Preferences,
  catalog: Catalog,
  day: number,
  cycle: number,
) {
  const raw = preferences.nutrition_track === "raw";
  const goal = focus(preferences);
  const recipes = safeRecipes(
    catalog.recipes,
    raw ? { ...preferences, nutrition_track: "vegetarian" } : preferences,
  );
  const offset = day - 1 + (cycle - 1) * 30;
  const histories = [breakfasts, lunches, dinners];
  const chosen = new Set<string>();
  return histories.map((slugs, index) => {
    const pool = slugs.flatMap((slug) =>
      recipes.filter((r) => r.slug === slug && !chosen.has(r.id)),
    );
    const recipe =
      pool[(offset + index * Math.floor(day / 7)) % Math.max(1, pool.length)];
    if (recipe) chosen.add(recipe.id);
    const title = ru.month.meals[index];
    return {
      title: recipe ? `${title} · ${recipe.title}` : title,
      recipe,
      description: recipe
        ? [
            recipe.description,
            ru.month.mealGuide[index],
            goal === "muscle"
              ? ru.month.muscleMeal
              : goal === "fat_loss"
                ? ru.month.fatLossMeal
                : ru.month.mealPortion,
            ...(raw && index === 2
              ? [ru.month.rawMeal, ru.nutritionSafety]
              : []),
            ru.month.checkFood,
          ]
            .filter(Boolean)
            .join("\n")
        : ru.month.noMeal,
    };
  });
}
