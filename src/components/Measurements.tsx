"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { localDate } from "@/domain/dates";
import {
  measurementSchema,
  type Measurement,
  type MeasurementValues,
} from "@/domain/measurements";
import { ru } from "@/i18n/ru";
import { api } from "@/lib/api-client";
import { data } from "@/lib/data";
import { demoProfile } from "@/lib/demo";
import { configured } from "@/lib/supabase/browser";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Input } from "./ui/Fields";
import { QueryState } from "./QueryState";
import styles from "./App.module.css";

const fields = Object.entries(ru.month.measurementFields) as [
  keyof MeasurementValues,
  string,
][];

export function Measurements() {
  const cache = useQueryClient();
  const profile = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    enabled: configured,
  });
  const today = localDate(profile.data?.timezone ?? demoProfile.timezone);
  const [before, setBefore] = useState<string>();
  const [editing, setEditing] = useState<Measurement>();
  const [formVersion, setFormVersion] = useState(0);
  const [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["measurements", before],
    queryFn: () => data.measurements(before),
  });
  const invalidate = () =>
    cache.invalidateQueries({ queryKey: ["measurements"] });
  const save = useMutation({
    mutationFn: ({
      date,
      values,
    }: {
      date: string;
      values: MeasurementValues;
    }) => data.saveMeasurement(date, values),
    onSuccess: async () => {
      setEditing(undefined);
      setFormVersion((v) => v + 1);
      setBefore(undefined);
      setMessage(ru.saved);
      await invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: data.removeMeasurement,
    onSuccess: async (_, date) => {
      if (editing?.local_date === date) {
        setEditing(undefined);
        setFormVersion((v) => v + 1);
      }
      await invalidate();
    },
  });
  const busy = save.isPending || remove.isPending;
  const rows = query.data?.slice(0, 30) ?? [];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const values = measurementSchema.safeParse(
      Object.fromEntries(
        fields.map(([key]) => {
          const raw = String(form.get(key) ?? "")
            .trim()
            .replace(",", ".");
          return [key, raw ? Number(raw) : null];
        }),
      ),
    );
    if (!values.success) {
      setMessage(ru.month.measurementError);
      return;
    }
    save.mutate({ date: String(form.get("date")), values: values.data });
  }
  return (
    <Card>
      <div className={styles.stack}>
        <h2>{ru.month.measurements}</h2>
        <p>{ru.month.measurementHint}</p>
        <form key={formVersion} className={styles.form} onSubmit={submit}>
          <label>
            {ru.month.date}
            <Input
              name="date"
              type="date"
              required
              max={today}
              defaultValue={editing?.local_date ?? today}
              readOnly={Boolean(editing)}
            />
          </label>
          <div className={styles.grid}>
            {fields.map(([key, label]) => (
              <label key={key}>
                {label}
                <Input
                  name={key}
                  inputMode="decimal"
                  maxLength={6}
                  defaultValue={editing?.[key] ?? ""}
                />
              </label>
            ))}
          </div>
          <div className={styles.row}>
            <Button disabled={busy || (configured && !profile.data)}>
              {ru.save}
            </Button>
            {editing && (
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(undefined);
                  setFormVersion((v) => v + 1);
                }}
              >
                {ru.cancel}
              </Button>
            )}
          </div>
          {message && <p role="status">{message}</p>}
          {(save.isError || remove.isError) && <p role="alert">{ru.error}</p>}
        </form>
        <QueryState
          pending={query.isPending}
          error={query.error}
          retry={() => query.refetch()}
        />
        {query.data?.length === 0 && <p>{ru.empty}</p>}
        {rows.map((row) => (
          <details key={row.local_date} className={styles.day}>
            <summary>{row.local_date}</summary>
            {fields.map(
              ([key, label]) =>
                row[key] !== null && (
                  <p key={key}>
                    {label} · {row[key]?.toLocaleString("ru")}
                  </p>
                ),
            )}
            <div className={styles.row}>
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(row);
                  setFormVersion((v) => v + 1);
                  setMessage("");
                }}
              >
                {ru.month.editMeasurement}
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => remove.mutate(row.local_date)}
              >
                {ru.month.removeMeasurement}
              </Button>
            </div>
          </details>
        ))}
        <div className={styles.row}>
          {before && (
            <Button type="button" onClick={() => setBefore(undefined)}>
              {ru.month.latestMeasurements}
            </Button>
          )}
          {(query.data?.length ?? 0) > rows.length && (
            <Button
              type="button"
              onClick={() => setBefore(rows.at(-1)?.local_date)}
            >
              {ru.month.olderMeasurements}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
