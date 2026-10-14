import { z } from "zod";
export const tracks = ["healthy", "vegetarian", "raw"] as const;
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  });
export const profileSchema = z.object({
  display_name: z.string().trim().max(80).default(""),
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }),
  age_range: z.enum(["", "18-29", "30-44", "45-59", "60+"]).default(""),
});
export const preferencesSchema = z
  .object({
    nutrition_track: z.enum(tracks),
    goals: z
      .array(
        z.enum([
          "nutrition",
          "flexibility",
          "strength",
          "energy",
          "routine",
          "walking",
        ]),
      )
      .min(1)
      .max(6),
    time_budget_minutes: z.union([
      z.literal(5),
      z.literal(10),
      z.literal(15),
      z.literal(20),
      z.literal(30),
      z.literal(45),
    ]),
    activity_level: z.enum(["beginner", "intermediate"]),
    equipment: z.array(z.enum(["none", "mat", "chair", "bands"])).max(4),
    excluded_exercises: z.array(z.string().max(100)).max(30),
    food_allergies: z.array(z.string().max(80)).max(30),
    limitations: z.string().max(500).default(""),
    cold_opt_in: z.boolean(),
    cold_safety_ack: z.boolean().default(false),
    safety_ack: z.literal(true),
    preferred_local_time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .default("19:00"),
    reminders_enabled: z.boolean().default(false),
  })
  .refine((v) => !v.cold_opt_in || v.cold_safety_ack, {
    message: "Cold safety acknowledgement required",
    path: ["cold_safety_ack"],
  });
export const onboardingSchema = z.object({
  profile: profileSchema,
  preferences: preferencesSchema,
});
export const checkinSchema = z.object({
  energy: z.number().int().min(1).max(5),
  difficulty: z.number().int().min(1).max(5),
  mood: z.number().int().min(1).max(5).nullable().default(null),
  pain_flag: z.boolean(),
  illness_flag: z.boolean(),
  notes: z.string().max(1000).default(""),
});
export const taskStatusSchema = z.object({
  status: z.enum(["pending", "completed", "skipped"]),
});
export type Profile = z.infer<typeof profileSchema> & {
  id?: string;
  role?: string;
};
export type Preferences = z.infer<typeof preferencesSchema>;
export type Checkin = z.infer<typeof checkinSchema> & { local_date?: string };
export const defaults: Preferences = {
  nutrition_track: "healthy",
  goals: ["energy", "routine"],
  time_budget_minutes: 15,
  activity_level: "beginner",
  equipment: ["none"],
  excluded_exercises: [],
  food_allergies: [],
  limitations: "",
  cold_opt_in: false,
  cold_safety_ack: false,
  safety_ack: true,
  preferred_local_time: "19:00",
  reminders_enabled: false,
};
