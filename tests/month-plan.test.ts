import { describe, expect, it } from "vitest";
import { content } from "@/domain/content";
import { measurementSchema } from "@/domain/measurements";
import { generatePlan } from "@/domain/plan";
import { defaults, type Preferences } from "@/domain/schemas";
import { pushPayload } from "@/domain/push-payload";
import { ru } from "@/i18n/ru";

const plan = (overrides: Partial<Parameters<typeof generatePlan>[0]> = {}) =>
  generatePlan({
    preferences: defaults,
    checkins: [],
    recentCompletion: 0,
    templates: [],
    catalog: content as Parameters<typeof generatePlan>[0]["catalog"],
    cycle: 1,
    day: 1,
    ...overrides,
  });

describe("30-day home cycle", () => {
  it.each(["beginner", "intermediate", "advanced"] as const)(
    "provides movement or recovery and three meals at the %s level",
    (activity_level) => {
      for (let day = 1; day <= 30; day++) {
        const { tasks } = plan({
          day,
          preferences: { ...defaults, activity_level },
        });
        expect(tasks).toHaveLength(4);
        expect(
          tasks.filter((task) => task.category === "nutrition"),
        ).toHaveLength(3);
        expect(
          tasks.every(
            (task) => task.estimated_minutes <= defaults.time_budget_minutes,
          ),
        ).toBe(true);
        if (day % 7 === 0 || day === 30)
          expect(tasks[0].category).toBe("recovery");
      }
    },
  );

  it("uses the selected training focus and rotates sessions across cycles", () => {
    const prefs = (goal: Preferences["goals"][number]) => ({
      ...defaults,
      goals: [goal],
    });
    expect(plan({ day: 3, preferences: prefs("muscle") }).tasks[0].title).toBe(
      ru.month.sessions.strength,
    );
    expect(
      plan({ day: 3, preferences: prefs("fat_loss") }).tasks[0].title,
    ).toBe(ru.month.sessions.mobility);
    expect(plan({ cycle: 1 }).tasks.map((t) => t.description)).not.toEqual(
      plan({ cycle: 2 }).tasks.map((t) => t.description),
    );
  });

  it("preserves a recovery session for a five-minute budget and low energy", () => {
    const checkin = {
      energy: 1,
      difficulty: 4,
      mood: null,
      pain_flag: false,
      illness_flag: false,
      notes: "",
    };
    const preferences = { ...defaults, time_budget_minutes: 5 } as const;
    const tired = plan({ preferences, checkins: [checkin] });
    expect(tired.tasks[0].category).toBe("stretching");
    expect(tired.tasks[0].estimated_minutes).toBe(3);
    const pain = plan({
      preferences,
      checkins: [{ ...checkin, pain_flag: true }],
    });
    expect(pain.tasks[0].category).toBe("recovery");
  });

  it("keeps allergen exclusions for each meal and exercise exclusions in the session", () => {
    const original = plan();
    const breakfast = content.recipes.find(
      (recipe) => recipe.id === original.tasks[1].reference_id,
    )!;
    const result = plan({
      preferences: {
        ...defaults,
        food_allergies: [breakfast.ingredients[0].name],
        excluded_exercises: ["chair-squat"],
      },
    });
    expect(result.tasks[1].reference_id).not.toBe(breakfast.id);
    expect(result.tasks[0].description).not.toContain("Вставание со стула");
  });

  it("shows an optional raw addition with a cooked meal", () => {
    const result = plan({
      preferences: { ...defaults, nutrition_track: "raw" },
    });
    expect(result.tasks[3].description).toContain(ru.month.rawMeal);
    expect(
      content.recipes.find((r) => r.id === result.tasks[3].reference_id)
        ?.track_tags,
    ).toContain("vegetarian");
  });

  it("uses the daily plan and screen break push copy", () => {
    expect(pushPayload("daily_plan", "date:food")).toMatchObject({
      title: ru.month.pushTitle,
      url: "/today",
    });
    expect(pushPayload("screen_break", "date:movement")).toMatchObject({
      body: ru.month.screenBody,
      url: "/today",
    });
  });
});

it("requires a measurement and supports one decimal digit", () => {
  const empty = {
    weight_kg: null,
    chest_cm: null,
    waist_cm: null,
    hips_cm: null,
  };
  expect(measurementSchema.safeParse(empty).success).toBe(false);
  expect(
    measurementSchema.safeParse({ ...empty, weight_kg: 75.15 }).success,
  ).toBe(false);
  expect(
    measurementSchema.safeParse({ ...empty, waist_cm: 85.5 }).success,
  ).toBe(true);
});
