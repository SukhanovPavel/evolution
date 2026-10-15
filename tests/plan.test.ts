import { describe, it, expect } from "vitest";
import {
  generatePlan,
  previewProgram,
  safeRecipes,
  safeExercises,
  Catalog,
} from "@/domain/plan";
import { defaults, Checkin } from "@/domain/schemas";
import { content, TemplateTask } from "@/domain/content";
import { localDate, addDays, programExpired } from "@/domain/dates";
import { progressSummary } from "@/domain/progress";
const input = {
  preferences: defaults,
  checkins: [] as Checkin[],
  templates: content.program_template_tasks as TemplateTask[],
  day: 1,
  catalog: content as unknown as Catalog,
  recentCompletion: 1,
};
describe("daily plan", () => {
  it("assigns squats and push-ups to beginners, including with walking goals", () => {
    for (const goals of [["routine"], ["walking", "strength"]] as const) {
      const result = generatePlan({
        ...input,
        preferences: { ...defaults, goals: [...goals] },
      });
      const task = result.tasks.find((t) => t.category === "activity")!;
      const ids = input.catalog.routine_exercises
        .filter((i) => i.routine_id === task.reference_id)
        .map((i) => i.exercise_id);
      expect(ids).toContain(
        content.exercises.find((e) => e.slug === "squat")!.id,
      );
      expect(ids).toContain(
        content.exercises.find((e) => e.slug === "wall-push")!.id,
      );
    }
  });
  it("selects a distinct intermediate routine when time permits", () => {
    const result = generatePlan({
      ...input,
      preferences: {
        ...defaults,
        activity_level: "intermediate",
        time_budget_minutes: 20,
      },
    });
    expect(
      result.tasks.some(
        (t) =>
          t.reference_id ===
          content.routines.find((r) => r.slug === "strength-intermediate")!.id,
      ),
    ).toBe(true);
  });
  it("never includes an excluded exercise through a routine", () => {
    const result = generatePlan({
      ...input,
      preferences: { ...defaults, excluded_exercises: ["squat", "wall-push"] },
    });
    for (const task of result.tasks) {
      const excludedIds = content.exercises
        .filter((e) => ["squat", "wall-push"].includes(e.slug))
        .map((e) => e.id);
      expect(excludedIds).not.toContain(task.reference_id);
      expect(
        input.catalog.routine_exercises
          .filter((i) => i.routine_id === task.reference_id)
          .some((i) => excludedIds.includes(i.exercise_id)),
      ).toBe(false);
    }
  });
  it("keeps rest days and previews consistent with generated movement", () => {
    const preview = previewProgram(input);
    for (let day = 1; day <= 30; day++) {
      const actual = generatePlan({ ...input, day });
      expect(
        preview.filter((t) => t.day_number === day).map((t) => t.payload.title),
      ).toEqual(actual.tasks.map((t) => t.title));
      if (day % 7 === 0)
        expect(actual.tasks.some((t) => t.category === "activity")).toBe(false);
    }
  });
  it("uses a real three-minute beginner circuit within a five-minute budget", () => {
    const result = generatePlan({
      ...input,
      preferences: { ...defaults, time_budget_minutes: 5 },
    });
    expect(
      result.tasks.some(
        (t) =>
          t.reference_id ===
          content.routines.find((r) => r.slug === "strength-mini")!.id,
      ),
    ).toBe(true);
  });

  it("ends a starter cycle after exactly 30 local days", () => {
    expect(programExpired("2026-10-01", "2026-10-30")).toBe(false);
    expect(programExpired("2026-10-01", "2026-10-31")).toBe(true);
  });

  it("low feedback actually reduces assigned activity", () => {
    const c = {
      energy: 1,
      difficulty: 5,
      mood: null,
      pain_flag: false,
      illness_flag: false,
      notes: "",
    };
    const normal = generatePlan(input),
      low = generatePlan({ ...input, checkins: [c] });
    expect(low.tasks.reduce((s, t) => s + t.estimated_minutes, 0)).toBeLessThan(
      normal.tasks.reduce((s, t) => s + t.estimated_minutes, 0),
    );
  });
  it("progresses at most one additional movement minute for beginners", () => {
    const c = {
      energy: 5,
      difficulty: 1,
      mood: null,
      pain_flag: false,
      illness_flag: false,
      notes: "",
    };
    const normal = generatePlan(input),
      easy = generatePlan({ ...input, checkins: [c, c, c] });
    expect(easy.adaptation_reason).toBe("gentle_progress");
    expect(
      easy.tasks
        .filter((t) => t.category === "activity")
        .reduce((s, t) => s + t.estimated_minutes, 0) -
        normal.tasks
          .filter((t) => t.category === "activity")
          .reduce((s, t) => s + t.estimated_minutes, 0),
    ).toBeLessThanOrEqual(1);
  });

  it("handles deactivated joined exercises without unsafe fallbacks", () => {
    expect(
      safeExercises(
        [
          null,
          ...input.catalog.exercises.map((e) => ({ ...e, active: false })),
        ],
        defaults,
      ),
    ).toEqual([]);
  });
  it("keeps limitations conservative and transparent", () => {
    const r = generatePlan({
      ...input,
      preferences: { ...defaults, limitations: "Ограничение" },
    });
    expect(r.adaptation_reason).toBe("limitations");
    expect(r.tasks.some((t) => t.category === "activity")).toBe(false);
  });

  it.each([5, 10, 15, 20, 30, 45] as const)(
    "respects %i minute budget",
    (budget) => {
      const result = generatePlan({
        ...input,
        preferences: { ...defaults, time_budget_minutes: budget },
      });
      expect(result.tasks.length).toBeGreaterThanOrEqual(3);
      expect(
        result.tasks.reduce((s, t) => s + t.estimated_minutes, 0),
      ).toBeLessThanOrEqual(budget);
    },
  );
  it("is deterministic", () =>
    expect(generatePlan(input)).toEqual(generatePlan(input)));
  it.each(["pain_flag", "illness_flag"])("never escalates after %s", (flag) => {
    const c = {
      energy: 5,
      difficulty: 1,
      mood: null,
      pain_flag: false,
      illness_flag: false,
      notes: "",
      [flag]: true,
    };
    const result = generatePlan({ ...input, checkins: [c, c, c] });
    expect(result.adaptation_reason).toBe("recovery");
    expect(
      result.tasks.every(
        (t) => !["activity", "stretching"].includes(t.category),
      ),
    ).toBe(true);
  });
  it("gates cold education", () => {
    expect(
      generatePlan(input).tasks.some((t) => t.title.includes("воде")),
    ).toBe(false);
  });
  it("filters allergies and excluded exercises", () => {
    expect(
      safeRecipes(input.catalog.recipes, {
        ...defaults,
        food_allergies: ["нут"],
      }).some((r) => r.ingredients.some((i) => i.name.includes("Нут"))),
    ).toBe(false);
    expect(
      safeExercises(input.catalog.exercises, {
        ...defaults,
        excluded_exercises: ["walk"],
      }).some((e) => e.slug === "walk"),
    ).toBe(false);
  });
  it("handles timezone boundaries and leap dates", () => {
    expect(localDate("Asia/Tokyo", new Date("2026-10-13T23:30:00Z"))).toBe(
      "2026-10-14",
    );
    expect(
      localDate("America/Los_Angeles", new Date("2026-10-14T01:00:00Z")),
    ).toBe("2026-10-13");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("does not fabricate progress", () => {
    expect(
      progressSummary([], [], [], "2026-10-01", "2026-10-14").completed,
    ).toBe(0);
  });
  it("includes 30 exercises, 24 recipes and 30 days per track", () => {
    expect(content.exercises.length).toBeGreaterThanOrEqual(30);
    expect(content.recipes).toHaveLength(24);
    for (const t of content.program_templates)
      expect(
        new Set(
          content.program_template_tasks
            .filter((v) => v.program_template_id === t.id)
            .map((v) => v.day_number),
        ).size,
      ).toBe(30);
  });
});
