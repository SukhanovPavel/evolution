"use client";
import { Input, Select, Textarea } from "./ui/Fields";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWatch, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  onboardingSchema,
  defaults,
  Profile,
  Preferences,
} from "@/domain/schemas";
import { ru } from "@/i18n/ru";
import { api } from "@/lib/api-client";
import { configured } from "@/lib/supabase/browser";
import { useUiStore } from "@/lib/ui-store";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import styles from "./App.module.css";
export function Onboarding({ settings = false }: { settings?: boolean }) {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    enabled: configured,
  });
  const prefs = useQuery({
    queryKey: ["preferences"],
    queryFn: api.preferences,
    enabled: configured,
  });
  if (settings && configured && (me.isPending || prefs.isPending))
    return <p>{ru.loading}</p>;
  return (
    <Editor
      settings={settings}
      profile={me.data}
      preferences={prefs.data ?? undefined}
    />
  );
}
function Editor({
  settings,
  profile,
  preferences,
}: {
  settings: boolean;
  profile?: Profile;
  preferences?: Preferences;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const step = useUiStore((v) => v.onboardingStep);
  const setStep = useUiStore((v) => v.setStep);
  const client = useQueryClient();
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      profile: profile ?? {
        display_name: "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        age_range: "" as const,
      },
      preferences: preferences ?? {
        ...defaults,
        safety_ack: undefined as unknown as true,
      },
    },
  });
  const values = useWatch({ control });
  async function submit(v: { profile: Profile; preferences: Preferences }) {
    try {
      if (!configured) {
        const { setDemoPreferences } = await import("@/lib/demo");
        setDemoPreferences(v.profile, v.preferences);
      } else if (settings) {
        await api.saveProfile(v.profile);
        await import("@/lib/api-client").then(({ request }) =>
          request("preferences", {
            method: "PUT",
            body: JSON.stringify(v.preferences),
          }),
        );
      } else await api.onboarding(v.profile, v.preferences);
      await client.invalidateQueries();
      if (settings) setMessage(ru.saved);
      else router.push("/today");
    } catch {
      setMessage(ru.error);
    }
  }
  return (
    <div className={styles.stack}>
      <h1>{settings ? ru.settings : ru.onboarding}</h1>
      {!settings && (
        <div className={styles.tabs}>
          {ru.steps.map((title, i) => (
            <button
              type="button"
              key={title}
              className={i === step ? styles.selected : ""}
              onClick={() => setStep(i)}
            >
              {i + 1}. {title}
            </button>
          ))}
        </div>
      )}
      <Card>
        <form className={styles.form} onSubmit={handleSubmit(submit)}>
          {(settings || step === 0) && (
            <>
              <label>
                {ru.name}
                <Input {...register("profile.display_name")} />
              </label>
              <label>
                {ru.age}
                <Select {...register("profile.age_range")}>
                  {["", "18-29", "30-44", "45-59", "60+"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </Select>
              </label>
              <label>
                {ru.timezone}
                <Input {...register("profile.timezone")} />
              </label>
              <label>
                {ru.budget}
                <Select
                  {...register("preferences.time_budget_minutes", {
                    valueAsNumber: true,
                  })}
                >
                  {[5, 10, 15, 20, 30, 45].map((v) => (
                    <option key={v} value={v}>
                      {v} {ru.minutes}
                    </option>
                  ))}
                </Select>
              </label>
              <fieldset>
                <legend>{ru.goals}</legend>
                {Object.entries(ru.goalNames).map(([key, label]) => (
                  <label className={styles.checkbox} key={key}>
                    <Input
                      type="checkbox"
                      value={key}
                      {...register("preferences.goals")}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            </>
          )}
          {(settings || step === 1) && (
            <>
              <label>
                {ru.track}
                <Select {...register("preferences.nutrition_track")}>
                  {Object.entries(ru.tracks).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </label>
              <p className={styles.muted}>{ru.nutritionSafety}</p>
              <label>
                {ru.level}
                <Select {...register("preferences.activity_level")}>
                  <option value="beginner">{ru.beginner}</option>
                  <option value="intermediate">{ru.intermediate}</option>
                </Select>
              </label>
              <fieldset>
                <legend>{ru.equipment}</legend>
                {Object.entries(ru.equipmentNames).map(([key, label]) => (
                  <label key={key} className={styles.checkbox}>
                    <Input
                      type="checkbox"
                      value={key}
                      {...register("preferences.equipment")}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <label>
                {ru.allergies}
                <Input
                  defaultValue={preferences?.food_allergies.join(", ")}
                  onChange={(e) =>
                    setValue(
                      "preferences.food_allergies",
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </label>
              <label>
                {ru.exclusions}
                <Input
                  defaultValue={preferences?.excluded_exercises.join(", ")}
                  onChange={(e) =>
                    setValue(
                      "preferences.excluded_exercises",
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </label>
              <label>
                {ru.limitations}
                <Textarea {...register("preferences.limitations")} />
              </label>
            </>
          )}
          {(settings || step === 2) && (
            <>
              <p>{ru.wellness}</p>
              <label className={styles.checkbox}>
                <Input
                  type="checkbox"
                  {...register("preferences.safety_ack")}
                />
                {ru.safety}
              </label>
              <label className={styles.checkbox}>
                <Input
                  type="checkbox"
                  {...register("preferences.cold_opt_in")}
                />
                {ru.cold}
              </label>
              {values.preferences?.cold_opt_in && (
                <label className={styles.checkbox}>
                  <Input
                    type="checkbox"
                    {...register("preferences.cold_safety_ack")}
                  />
                  {ru.coldSafety}
                </label>
              )}
              <label>
                {ru.time}
                <Input
                  type="time"
                  {...register("preferences.preferred_local_time")}
                />
              </label>
              <label className={styles.checkbox}>
                <Input
                  type="checkbox"
                  {...register("preferences.reminders_enabled")}
                />
                {ru.reminders}
              </label>
            </>
          )}
          {Object.keys(errors).length > 0 && (
            <p role="alert" className={styles.danger}>
              {ru.error}
            </p>
          )}
          <div className={styles.row}>
            {!settings && step > 0 && (
              <Button type="button" onClick={() => setStep(step - 1)}>
                {ru.back}
              </Button>
            )}
            {!settings && step < 2 ? (
              <Button type="button" onClick={() => setStep(step + 1)}>
                {ru.next}
              </Button>
            ) : (
              <Button disabled={isSubmitting}>
                {settings ? ru.save : ru.start}
              </Button>
            )}
          </div>
          <p role="status">{message}</p>
        </form>
      </Card>
    </div>
  );
}
