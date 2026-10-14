import { request } from "./api-client";
import { configured } from "./supabase/browser";
import {
  demoPlan,
  demoTask,
  demoCheckin,
  demoCheckins,
  demoProgress,
  demoProgram,
  demoRoutine,
  demoSession,
  demoRecipes,
} from "./demo";
import { content, Exercise, Routine, Recipe } from "@/domain/content";
import type { Plan, Task, Program } from "@/domain/plan";
import type { Checkin } from "@/domain/schemas";
import type { Progress } from "@/domain/progress";
export const data = {
  checkins: (from: string, to: string) =>
    configured
      ? request<Checkin[]>(`checkins?from=${from}&to=${to}`)
      : Promise.resolve(demoCheckins(from, to)),
  plan: (date?: string) =>
    configured
      ? request<Plan | null>(`daily-plan${date ? `?date=${date}` : ""}`)
      : Promise.resolve(demoPlan(date)),
  task: (id: string, status: Task["status"]) =>
    configured
      ? request<Task>(`daily-tasks/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        })
      : Promise.resolve(demoTask(id, status)),
  checkin: (date: string, value: Checkin) =>
    configured
      ? request(`checkins/${date}`, {
          method: "PUT",
          body: JSON.stringify(value),
        })
      : Promise.resolve(demoCheckin(date, value)),
  program: () =>
    configured
      ? request<Program | null>("program")
      : Promise.resolve(demoProgram()),
  recipe: (slug: string) =>
    configured
      ? request<Recipe>(`recipes/${slug}`)
      : Promise.resolve(demoRecipes.find((r) => r.slug === slug)).then((v) => {
          if (!v) throw new Error("NOT_FOUND");
          return v;
        }),
  recipes: (query = "") =>
    configured
      ? request<Recipe[]>(`recipes?${query}`)
      : Promise.resolve(demoRecipes),
  exercises: () =>
    configured
      ? request<Exercise[]>("exercises?limit=100")
      : Promise.resolve(content.exercises as Exercise[]),
  routines: () =>
    configured
      ? request<Routine[]>("routines?limit=100")
      : Promise.resolve(content.routines),
  routine: (slug: string) =>
    configured
      ? request<Routine>(`routines/${slug}`)
      : Promise.resolve(demoRoutine(slug)),
  progress: (from: string, to: string) =>
    configured
      ? request<Progress>(`progress?from=${from}&to=${to}`)
      : Promise.resolve(demoProgress(from, to)),
  session: (routine_id: string, minutes: number) =>
    configured
      ? request("sessions", {
          method: "POST",
          body: JSON.stringify({ routine_id, minutes }),
        })
      : Promise.resolve(demoSession(routine_id, minutes)),
};
