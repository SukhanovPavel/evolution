import { NextRequest } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { ok, fail, HttpError, checked } from "@/lib/http";
import {
  profileSchema,
  preferencesSchema,
  onboardingSchema,
} from "@/domain/schemas";
import { z } from "zod";
import { Repository } from "@/lib/repository";
import { dateSchema, checkinSchema, taskStatusSchema } from "@/domain/schemas";
import {
  recipeSchema,
  exerciseSchema,
  templateBundleSchema,
} from "@/domain/content";
import { progressSummary } from "@/domain/progress";
import type { Plan } from "@/domain/plan";
import { localDate, addDays } from "@/domain/dates";
import {
  defaultNotificationSettings,
  notificationSettingsSchema,
  subscriptionSchema,
} from "@/domain/notifications";
import { pushConfigured, sendPush } from "@/server/push";
export async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    if (
      !["GET", "HEAD"].includes(req.method) &&
      !req.headers.get("authorization")
    ) {
      const origin = req.headers.get("origin");
      if (!origin || origin !== req.nextUrl.origin)
        throw new HttpError(403, "INVALID_ORIGIN");
    }
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )
      throw new HttpError(503, "SUPABASE_NOT_CONFIGURED");
    const bearer = req.headers.get("authorization");
    if (bearer && !/^Bearer [^ ]+$/.test(bearer))
      throw new HttpError(401, "UNAUTHORIZED");
    const client = await serverClient(bearer?.slice(7));
    const {
      data: { user },
      error,
    } = await client.auth.getUser(bearer?.slice(7));
    if (error || !user) throw new HttpError(401, "UNAUTHORIZED");
    const path = (await params).path.join("/");
    const method = req.method;
    const id = user.id;
    const repo = new Repository(client, id);
    const query = req.nextUrl.searchParams;
    if (path === "notifications/settings" && method === "GET") {
      const settings = checked(
        await client
          .from("push_settings")
          .select("*")
          .eq("user_id", id)
          .maybeSingle(),
      );
      const devices = checked(
        await client.from("push_subscriptions").select("id").eq("user_id", id),
      );
      return ok({
        settings: settings
          ? {
              ...settings,
              food_time: settings.food_time.slice(0, 5),
              work_start: settings.work_start.slice(0, 5),
              work_end: settings.work_end.slice(0, 5),
            }
          : defaultNotificationSettings,
        configured: pushConfigured(),
        deviceCount: devices?.length ?? 0,
        publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
      });
    }
    if (path === "notifications/settings" && method === "PUT") {
      const value = notificationSettingsSchema.parse(await req.json());
      if (value.enabled && !pushConfigured())
        throw new HttpError(503, "PUSH_NOT_CONFIGURED");
      checked(
        await client.from("push_settings").upsert({ ...value, user_id: id }),
      );
      return ok(value);
    }
    if (path === "notifications/subscriptions" && method === "POST") {
      if (!pushConfigured()) throw new HttpError(503, "PUSH_NOT_CONFIGURED");
      const sub = subscriptionSchema.parse(await req.json());
      return ok({
        id: checked(
          await client.rpc("register_push_subscription", {
            p_endpoint: sub.endpoint,
            p_p256dh: sub.keys.p256dh,
            p_auth: sub.keys.auth,
          }),
        ),
      });
    }
    if (path === "notifications/subscriptions" && method === "DELETE") {
      const { endpoint } = z
        .object({ endpoint: z.string().max(2048) })
        .parse(await req.json());
      checked(
        await client
          .from("push_subscriptions")
          .delete()
          .eq("user_id", id)
          .eq("endpoint", endpoint),
      );
      return ok({ removed: true });
    }
    if (path === "notifications/test" && method === "POST") {
      const { endpoint } = z
        .object({ endpoint: z.string().max(2048) })
        .parse(await req.json());
      const sub = checked(
        await client
          .from("push_subscriptions")
          .select("endpoint,p256dh,auth")
          .eq("user_id", id)
          .eq("endpoint", endpoint)
          .maybeSingle(),
      );
      if (!sub) throw new HttpError(404, "NOT_FOUND");
      await sendPush(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        "test",
        "test",
      );
      return ok({ sent: true });
    }
    const parts = path.split("/");
    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .parse(query.get("limit") ?? 50);
    const offset = z.coerce
      .number()
      .int()
      .min(0)
      .max(100000)
      .parse(query.get("offset") ?? 0);
    function range() {
      const to = dateSchema.parse(query.get("to") ?? localDate("UTC"));
      const from = dateSchema.parse(query.get("from") ?? addDays(to, -29));
      if (from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 366)
        throw new HttpError(422, "INVALID_RANGE");
      return { from, to };
    }
    if (path === "me" && method === "GET")
      return ok(
        checked(
          await client.from("profiles").select("*").eq("id", id).single(),
        ),
      );
    if (path === "me" && method === "PATCH") {
      const value = profileSchema.partial().parse(await req.json());
      return ok(
        checked(
          await client
            .from("profiles")
            .update(value)
            .eq("id", id)
            .select("*")
            .single(),
        ),
      );
    }
    if (path === "preferences" && method === "GET") {
      const prefs = checked(
        await client
          .from("user_preferences")
          .select("*")
          .eq("user_id", id)
          .maybeSingle(),
      );
      const notifications = checked(
        await client
          .from("notification_preferences")
          .select("*")
          .eq("user_id", id)
          .maybeSingle(),
      );
      return ok(prefs ? { ...prefs, ...notifications } : null);
    }
    if (path === "preferences" && method === "PUT") {
      const value = preferencesSchema.parse(await req.json());
      checked(await client.rpc("save_preferences", { p_preferences: value }));
      return ok(value);
    }
    if (path === "onboarding/complete" && method === "POST") {
      const value = onboardingSchema.parse(await req.json());
      const template = checked(
        await client
          .from("program_templates")
          .select("id")
          .eq("slug", `starter-${value.preferences.nutrition_track}`)
          .eq("published", true)
          .single(),
      );
      if (!template) throw new HttpError(404, "TEMPLATE_NOT_FOUND");
      checked(
        await client.rpc("complete_onboarding", {
          p_profile: value.profile,
          p_preferences: value.preferences,
          p_template: template.id,
          p_date: localDate(value.profile.timezone),
        }),
      );
      return ok({ complete: true });
    }

    if (path === "program" && method === "GET") return ok(await repo.program());
    if (path === "program/start" && method === "POST") {
      const value = z
        .object({ template_id: z.uuid().optional() })
        .parse(await req.json());
      const prefs = await repo.preferences();
      if (!prefs) throw new HttpError(409, "ONBOARDING_REQUIRED");
      const template =
        value.template_id ??
        checked(
          await client
            .from("program_templates")
            .select("id")
            .eq("slug", `starter-${prefs.nutrition_track}`)
            .eq("published", true)
            .single(),
        )?.id;
      if (!template) throw new HttpError(404, "TEMPLATE_NOT_FOUND");
      const profile = await repo.profile();
      checked(
        await client.rpc("start_program", {
          p_template: template,
          p_date: localDate(profile.timezone),
        }),
      );
      return ok(await repo.program());
    }
    if (path === "daily-plan" && method === "GET")
      return ok(
        await repo.plan(
          query.has("date") ? dateSchema.parse(query.get("date")) : undefined,
        ),
      );
    if (
      parts[0] === "daily-tasks" &&
      parts.length === 2 &&
      method === "PATCH"
    ) {
      const taskId = z.uuid().parse(parts[1]);
      const { status } = taskStatusSchema.parse(await req.json());
      const task = checked(
        await client
          .from("daily_tasks")
          .select("id,daily_plans(local_date)")
          .eq("id", taskId)
          .eq("user_id", id)
          .maybeSingle(),
      );
      if (!task) throw new HttpError(404, "NOT_FOUND");
      const profile = await repo.profile();
      const parent = task.daily_plans as unknown as { local_date: string };
      if (parent.local_date !== localDate(profile.timezone))
        throw new HttpError(409, "HISTORY_READ_ONLY");
      return ok(
        checked(
          await client
            .from("daily_tasks")
            .update({
              status,
              completed_at:
                status === "completed" ? new Date().toISOString() : null,
            })
            .eq("id", taskId)
            .eq("user_id", id)
            .select("*")
            .single(),
        ),
      );
    }
    if (path === "checkins" && method === "GET") {
      const { from, to } = range();
      return ok(
        checked(
          await client
            .from("daily_checkins")
            .select("*")
            .eq("user_id", id)
            .gte("local_date", from)
            .lte("local_date", to)
            .order("local_date")
            .range(offset, offset + limit - 1),
        ),
      );
    }
    if (parts[0] === "checkins" && parts.length === 2 && method === "PUT") {
      const date = dateSchema.parse(parts[1]),
        profile = await repo.profile();
      if (date !== localDate(profile.timezone))
        throw new HttpError(409, "CURRENT_DATE_ONLY");
      const value = checkinSchema.parse(await req.json());
      return ok(
        checked(
          await client
            .from("daily_checkins")
            .upsert(
              { ...value, user_id: id, local_date: date },
              { onConflict: "user_id,local_date" },
            )
            .select("*")
            .single(),
        ),
      );
    }
    if (
      ["recipes", "exercises", "routines"].includes(parts[0]) &&
      method === "GET" &&
      parts.length <= 2
    ) {
      let q = client
        .from(parts[0])
        .select(
          parts[0] === "routines" && parts.length === 2
            ? "*,routine_exercises(*,exercises(*))"
            : "*",
        )
        .eq("active", true);
      if (parts.length === 2) {
        const value = checked(await q.eq("slug", parts[1]).maybeSingle());
        if (!value) throw new HttpError(404, "NOT_FOUND");
        return ok(value);
      }
      const search = query.get("search");
      if (search)
        q = q.ilike(
          "title",
          `%${z.string().max(100).parse(search).replace(/[%_]/g, "")}%`,
        );
      if (query.get("category") && parts[0] !== "recipes")
        q = q.eq(
          "category",
          z
            .enum(["activity", "stretching", "recovery"])
            .parse(query.get("category")),
        );
      if (query.get("track") && parts[0] === "recipes")
        q = q.contains("track_tags", [
          z.enum(["healthy", "vegetarian", "raw"]).parse(query.get("track")),
        ]);
      return ok(
        checked(await q.order("title").range(offset, offset + limit - 1)),
      );
    }
    if (path === "favorites" && method === "GET")
      return ok(
        checked(
          await client
            .from("user_recipe_favorites")
            .select("recipe_id")
            .eq("user_id", id),
        ),
      );
    if (
      parts[0] === "favorites" &&
      parts.length === 2 &&
      ["PUT", "DELETE"].includes(method)
    ) {
      const recipe_id = z.uuid().parse(parts[1]);
      if (method === "PUT")
        checked(
          await client
            .from("user_recipe_favorites")
            .upsert({ user_id: id, recipe_id }),
        );
      else
        checked(
          await client
            .from("user_recipe_favorites")
            .delete()
            .eq("user_id", id)
            .eq("recipe_id", recipe_id),
        );
      return ok({ saved: true });
    }
    if (path === "shopping-list" && method === "GET") {
      const ids = z
        .array(z.uuid())
        .min(1)
        .max(24)
        .parse((query.get("recipe_ids") ?? "").split(","));
      const recipes =
        checked(
          await client
            .from("recipes")
            .select("ingredients")
            .in("id", ids)
            .eq("active", true),
        ) ?? [];
      const items = new Map<
        string,
        { name: string; unit: string; quantity: number }
      >();
      for (const recipe of recipes)
        for (const ingredient of recipe.ingredients as {
          name: string;
          unit: string;
          quantity: number;
        }[]) {
          const key = `${ingredient.name}:${ingredient.unit}`;
          const existing = items.get(key);
          items.set(key, {
            ...ingredient,
            quantity: (existing?.quantity ?? 0) + ingredient.quantity,
          });
        }
      return ok([...items.values()]);
    }
    if (path === "progress" && method === "GET") {
      const { from, to } = range();
      const results = await Promise.all([
        client
          .from("daily_plans")
          .select("*,daily_tasks(*)")
          .eq("user_id", id)
          .gte("local_date", from)
          .lte("local_date", to)
          .order("local_date"),
        client
          .from("daily_checkins")
          .select("*")
          .eq("user_id", id)
          .gte("local_date", from)
          .lte("local_date", to)
          .order("local_date"),
        client
          .from("habit_events")
          .select("*")
          .eq("user_id", id)
          .gte("local_date", from)
          .lte("local_date", to),
      ]);
      return ok(
        progressSummary(
          checked(results[0]) as Plan[],
          checked(results[1]) ?? [],
          checked(results[2]) ?? [],
          from,
          to,
        ),
      );
    }
    if (path === "sessions" && method === "POST") {
      const value = z
        .object({
          routine_id: z.uuid(),
          minutes: z.number().int().min(0).max(60),
        })
        .parse(await req.json());
      const routine = checked(
        await client
          .from("routines")
          .select("id,category,estimated_minutes")
          .eq("id", value.routine_id)
          .eq("active", true)
          .maybeSingle(),
      );
      if (!routine) throw new HttpError(404, "NOT_FOUND");
      const profile = await repo.profile();
      return ok(
        checked(
          await client
            .from("habit_events")
            .insert({
              user_id: id,
              local_date: localDate(profile.timezone),
              category: routine.category,
              event_type: "routine_completed",
              metadata: {
                routine_id: routine.id,
                minutes: Math.min(value.minutes, routine.estimated_minutes),
              },
            })
            .select("*")
            .single(),
        ),
      );
    }
    if (path === "data/export" && method === "GET") {
      const tables = [
        "profiles",
        "user_preferences",
        "notification_preferences",
        "push_settings",
        "push_subscriptions",
        "user_programs",
        "daily_plans",
        "daily_tasks",
        "daily_checkins",
        "user_recipe_favorites",
        "habit_events",
      ];
      const output: Record<string, unknown> = {};
      for (const table of tables) {
        const rows: unknown[] = [];
        for (let offset = 0; ; offset += 500) {
          const batch =
            checked(
              await client
                .from(table)
                .select("*")
                .eq(table === "profiles" ? "id" : "user_id", id)
                .order(
                  table === "user_recipe_favorites"
                    ? "recipe_id"
                    : [
                          "user_preferences",
                          "notification_preferences",
                          "push_settings",
                        ].includes(table)
                      ? "user_id"
                      : "id",
                )
                .range(offset, offset + 499),
            ) ?? [];
          rows.push(...batch);
          if (batch.length < 500) break;
        }
        output[table] = rows;
      }
      return ok(output);
    }
    if (path === "data/delete" && method === "POST") {
      z.object({ confirmation: z.literal("УДАЛИТЬ") }).parse(await req.json());
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
        throw new HttpError(503, "ACCOUNT_DELETION_NOT_CONFIGURED");
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const result = await admin.auth.admin.deleteUser(id);
      if (result.error) throw new HttpError(500, "ACCOUNT_DELETION_FAILED");
      await client.auth.signOut();
      return ok({ deleted: true });
    }
    if (parts[0] === "admin") {
      const profile = await repo.profile();
      if (profile.role !== "admin") throw new HttpError(403, "ADMIN_REQUIRED");
      const table = z
        .enum(["recipes", "exercises", "program_templates"])
        .parse(parts[1]);
      if (parts.length === 2 && method === "GET") {
        let q = client.from(table).select("*");
        if (table === "program_templates")
          q = client.from(table).select("*,program_template_tasks(*)");
        return ok(
          checked(await q.order("title").range(offset, offset + limit - 1)),
        );
      }
      if (
        (parts.length === 2 && method === "POST") ||
        (parts.length === 3 && method === "PATCH")
      ) {
        const raw = await req.json();
        const value = (
          table === "recipes"
            ? recipeSchema
            : table === "exercises"
              ? exerciseSchema
              : templateBundleSchema
        ).parse(raw);
        const rowId = parts.length === 3 ? z.uuid().parse(parts[2]) : undefined;
        if (table === "program_templates") {
          const bundle = templateBundleSchema.parse(raw);
          checked(
            await client.rpc("save_template", {
              p_id: rowId ?? null,
              p_template: {
                slug: bundle.slug,
                title: bundle.title,
                category: bundle.category,
                difficulty: bundle.difficulty,
                duration_days: 30,
                published: bundle.published,
              },
              p_tasks: bundle.tasks,
            }),
          );
          return ok({ saved: true });
        }
        const result = rowId
          ? await client
              .from(table)
              .update(value)
              .eq("id", rowId)
              .select("*")
              .maybeSingle()
          : await client
              .from(table)
              .insert(value as Record<string, unknown>)
              .select("*")
              .single();
        const saved = checked(result);
        if (!saved) throw new HttpError(404, "NOT_FOUND");
        return ok(saved);
      }
      if (parts.length === 3 && method === "DELETE") {
        const rowId = z.uuid().parse(parts[2]);
        const result = checked(
          await client
            .from(table)
            .update(
              table === "program_templates"
                ? { published: false }
                : { active: false },
            )
            .eq("id", rowId)
            .select("id")
            .maybeSingle(),
        );
        if (!result) throw new HttpError(404, "NOT_FOUND");
        return ok({ deactivated: true });
      }
    }
    throw new HttpError(404, "NOT_FOUND");
  } catch (error) {
    return fail(error);
  }
}
