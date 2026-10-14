import { z } from "zod";
import fixtures from "./content.json";
export const ingredientSchema = z.object({
  name: z.string().min(1).max(100),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(30),
});
const text = z.string().min(1).max(2000);
const optionalUrl = z
  .url()
  .nullable()
  .refine((v) => !v || v.startsWith("https://"));
export const recipeSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: text,
  description: text,
  track_tags: z.array(z.enum(["healthy", "vegetarian", "raw"])).min(1),
  allergens: z.array(text),
  ingredients: z.array(ingredientSchema).min(1),
  instructions: z.array(text).min(1),
  servings: z.number().int().min(1).max(20),
  prep_minutes: z.number().int().min(1).max(240),
  nutrition_notes: text,
  image_url: optionalUrl.default(null),
  active: z.boolean(),
});
export const exerciseSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: text,
  category: z.enum(["activity", "stretching", "recovery"]),
  difficulty: z.enum(["beginner", "intermediate"]),
  description: text,
  instructions: z.array(text).min(1),
  common_mistakes: text,
  warnings: text,
  reps: z.number().int().min(1).max(100),
  seconds: z.number().int().min(5).max(600),
  rest_seconds: z.number().int().min(0).max(180),
  easier: text,
  harder: text,
  equipment: z.array(z.enum(["none", "mat", "chair", "bands"])),
  media_url: optionalUrl.default(null),
  active: z.boolean(),
});
export const templateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: text,
  category: z.enum(["healthy", "vegetarian", "raw"]),
  difficulty: z.enum(["beginner", "intermediate"]),
  duration_days: z.literal(30),
  published: z.boolean(),
});
export const templateTaskSchema = z.object({
  day_number: z.number().int().min(1).max(30),
  task_type: z.enum(["nutrition", "activity", "stretching", "recovery"]),
  payload: z.object({
    title: text,
    description: text,
    reference_type: z.enum(["recipe", "routine", "exercise"]).nullable(),
    reference_id: z.uuid().nullable(),
  }),
  estimated_minutes: z.number().int().min(0).max(45),
  sort_order: z.number().int().min(0).max(20),
});
export const templateBundleSchema = templateSchema.extend({
  tasks: z
    .array(templateTaskSchema)
    .min(90)
    .refine(
      (v) => new Set(v.map((t) => t.day_number)).size === 30,
      "All 30 days required",
    )
    .refine(
      (v) =>
        new Set(v.map((t) => `${t.day_number}:${t.sort_order}`)).size ===
        v.length,
      "Duplicate task order",
    ),
});
export type Recipe = z.infer<typeof recipeSchema> & { id: string };
export type Exercise = z.infer<typeof exerciseSchema> & { id: string };
export type Routine = {
  id: string;
  slug: string;
  title: string;
  category: string;
  difficulty: string;
  estimated_minutes: number;
  active: boolean;
  routine_exercises?: {
    exercise_id: string;
    sort_order: number;
    seconds: number;
    rest_seconds: number;
    reps: number;
    exercises: Exercise | null;
  }[];
};
export type TemplateTask = z.infer<typeof templateTaskSchema> & {
  id: string;
  program_template_id: string;
};
export const content = fixtures;
