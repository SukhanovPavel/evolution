import "server-only";
import { SupabaseClient } from "@supabase/supabase-js";
import { checked, HttpError } from "./http";
import { generatePlan, Plan, Program, Catalog } from "@/domain/plan";
import { Recipe, Exercise, Routine, TemplateTask } from "@/domain/content";
import { Preferences, Checkin } from "@/domain/schemas";
import { localDate, addDays, dayNumber, programExpired } from "@/domain/dates";
export class Repository {
  constructor(
    public client: SupabaseClient,
    public userId: string,
  ) {}
  async profile() {
    const p = checked(
      await this.client
        .from("profiles")
        .select("*")
        .eq("id", this.userId)
        .single(),
    );
    if (!p) throw new HttpError(404, "PROFILE_NOT_FOUND");
    return p;
  }
  async preferences() {
    return checked(
      await this.client
        .from("user_preferences")
        .select("*")
        .eq("user_id", this.userId)
        .maybeSingle(),
    ) as Preferences | null;
  }
  async program() {
    const p = checked(
      await this.client
        .from("user_programs")
        .select("*,program_templates(*)")
        .eq("user_id", this.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    if (!p) return null;
    if (
      p.status === "active" &&
      programExpired(p.start_date, localDate((await this.profile()).timezone))
    ) {
      checked(
        await this.client
          .from("user_programs")
          .update({ status: "completed" })
          .eq("id", p.id)
          .eq("user_id", this.userId),
      );
      p.status = "completed";
    }
    const tasks = checked(
      await this.client
        .from("program_template_tasks")
        .select("*")
        .eq("program_template_id", p.template_id)
        .order("day_number")
        .order("sort_order"),
    );
    return { ...p, tasks } as Program;
  }
  async plan(date?: string) {
    const profile = await this.profile();
    const today = localDate(profile.timezone);
    const requested = date ?? today;
    if (requested > today) throw new HttpError(422, "FUTURE_DATE");
    let plan = checked(
      await this.client
        .from("daily_plans")
        .select("*,daily_tasks(*)")
        .eq("user_id", this.userId)
        .eq("local_date", requested)
        .maybeSingle(),
    ) as Plan | null;
    if (plan || requested !== today) return plan;
    const preferences = await this.preferences(),
      program = await this.program();
    if (!preferences || !program)
      throw new HttpError(409, "ONBOARDING_REQUIRED");
    if (program.status !== "active")
      throw new HttpError(409, "PROGRAM_COMPLETED");
    const results = await Promise.all([
      this.client.from("recipes").select("*").eq("active", true),
      this.client.from("exercises").select("*").eq("active", true),
      this.client.from("routines").select("*").eq("active", true),
      this.client.from("routine_exercises").select("*"),
      this.client
        .from("daily_checkins")
        .select("*")
        .eq("user_id", this.userId)
        .lt("local_date", today)
        .gte("local_date", addDays(today, -7))
        .order("local_date", { ascending: false })
        .limit(3),
      this.client
        .from("daily_plans")
        .select("daily_tasks(status)")
        .eq("user_id", this.userId)
        .lt("local_date", today)
        .gte("local_date", addDays(today, -7)),
    ]);
    const [recipes, exercises, routines, items, checkins, previous] =
      results.map((r) => checked(r));
    const statuses = (previous ?? []).flatMap((p) => p.daily_tasks ?? []) as {
      status: string;
    }[];
    const result = generatePlan({
      preferences,
      checkins: checkins as Checkin[],
      templates: program.tasks as TemplateTask[],
      day: dayNumber(program.start_date, today),
      catalog: {
        recipes: recipes as Recipe[],
        exercises: exercises as Exercise[],
        routines: routines as Routine[],
        routine_exercises: items ?? [],
      } as Catalog,
      recentCompletion: statuses.length
        ? statuses.filter((t) => t.status === "completed").length /
          statuses.length
        : 0,
    });
    const planId = checked(
      await this.client.rpc("save_daily_plan", {
        p_date: today,
        p_timezone: profile.timezone,
        p_reason: result.adaptation_reason,
        p_tasks: result.tasks,
      }),
    );
    plan = checked(
      await this.client
        .from("daily_plans")
        .select("*,daily_tasks(*)")
        .eq("id", planId)
        .eq("user_id", this.userId)
        .single(),
    ) as Plan;
    plan.daily_tasks.sort((a, b) => a.sort_order - b.sort_order);
    return plan;
  }
}
