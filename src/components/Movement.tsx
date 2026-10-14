"use client";
import { Input, Select } from "./ui/Fields";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { data } from "@/lib/data";
import { api } from "@/lib/api-client";
import { configured } from "@/lib/supabase/browser";
import { demoPreferences } from "@/lib/demo";
import { Exercise, Routine } from "@/domain/content";
import { safeExercises } from "@/domain/plan";
import { ru } from "@/i18n/ru";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Modal } from "./Modal";
import { ExerciseDetail } from "./ContentDetail";
import { QueryState } from "./QueryState";
import styles from "./App.module.css";
export function Movement() {
  const [tab, setTab] = useState("routines");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<Exercise | null>(null);
  const routines = useQuery({ queryKey: ["routines"], queryFn: data.routines });
  const exercises = useQuery({
    queryKey: ["exercises"],
    queryFn: data.exercises,
  });
  const preferences = useQuery({
    queryKey: ["preferences"],
    queryFn: api.preferences,
    enabled: configured,
  });
  const items = tab === "routines" ? routines : exercises;
  const match = (v: Exercise | Routine) =>
    v.title.toLowerCase().includes(search.toLowerCase()) &&
    (category === "all" || v.category === category);
  return (
    <div className={styles.stack}>
      <h1>{ru.movement}</h1>
      <p className={styles.muted}>{ru.wellness}</p>
      <div className={styles.tabs}>
        {(["routines", "exercises"] as const).map((t) => (
          <button
            key={t}
            className={tab === t ? styles.selected : ""}
            onClick={() => setTab(t)}
          >
            {ru[t]}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <label>
          {ru.search}
          <Input
            className={styles.input}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          {ru.all}
          <Select
            className={styles.input}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">{ru.all}</option>
            {Object.entries(ru.categories)
              .filter(([k]) => k !== "nutrition")
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </Select>
        </label>
      </div>
      <QueryState
        pending={items.isPending}
        error={items.error}
        retry={() => items.refetch()}
      />
      <div className={styles.grid}>
        {tab === "routines"
          ? routines.data?.filter(match).map((r) => (
              <Card key={r.id}>
                <span className={styles.tag}>
                  {r.estimated_minutes} {ru.minutes}
                </span>
                <h2>{r.title}</h2>
                <Link href={`/movement/${r.slug}`}>{ru.play} →</Link>
              </Card>
            ))
          : safeExercises(
              exercises.data ?? [],
              preferences.data ?? demoPreferences,
            )
              .filter(match)
              .map((e) => (
                <Card key={e.id}>
                  <h2>{e.title}</h2>
                  <p className={styles.muted}>{e.description}</p>
                  <Button onClick={() => setSelected(e)}>{ru.details}</Button>
                </Card>
              ))}
      </div>
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <ExerciseDetail exercise={selected} />
        </Modal>
      )}
    </div>
  );
}
export function RoutinePlayer({ slug }: { slug: string }) {
  const query = useQuery({
    queryKey: ["routine", slug],
    queryFn: () => data.routine(slug),
  });
  const preferences = useQuery({
    queryKey: ["preferences"],
    queryFn: api.preferences,
    enabled: configured,
  });
  if (configured && preferences.isPending) return <p>{ru.loading}</p>;
  if (preferences.error)
    return (
      <QueryState
        pending={false}
        error={preferences.error}
        retry={() => preferences.refetch()}
      />
    );
  return (
    <div className={styles.stack}>
      <Link href="/movement">← {ru.movement}</Link>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => query.refetch()}
      />
      {query.data && (
        <Player
          routine={query.data}
          allowedIds={
            new Set(
              safeExercises(
                query.data.routine_exercises?.map((i) => i.exercises) ?? [],
                preferences.data ?? demoPreferences,
              ).map((e) => e.id),
            )
          }
        />
      )}
    </div>
  );
}
function Player({
  routine,
  allowedIds,
}: {
  routine: Routine;
  allowedIds: Set<string>;
}) {
  const steps =
    routine.routine_exercises
      ?.filter((v) => v.exercises && allowedIds.has(v.exercise_id))
      .sort((a, b) => a.sort_order - b.sort_order) ?? [];
  const segments = steps
    .flatMap((s) => [
      { exercise: s.exercises!, seconds: s.seconds, rest: false },
      { exercise: s.exercises!, seconds: s.rest_seconds, rest: true },
    ])
    .filter((s) => s.seconds > 0);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(segments[0]?.seconds ?? 0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  const elapsed = useRef(0);
  const started = useRef(0);
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      data.session(routine.id, Math.floor(elapsed.current / 60)),
    onSuccess: () => {
      setDone(true);
      setMessage(ru.sessionDone);
      cache.invalidateQueries({ queryKey: ["progress"] });
    },
    onError: () => setMessage(ru.error),
  });
  useEffect(() => {
    if (!running) return;
    started.current = Date.now();
    const initial = remaining;
    const previousElapsed = elapsed.current;
    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - started.current) / 1000);
      elapsed.current = previousElapsed + Math.min(seconds, initial);
      const left = Math.max(0, initial - seconds);
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [running, index, remaining]);
  function advance() {
    if (index + 1 >= segments.length) {
      setRunning(false);
      mutation.mutate();
    } else {
      setIndex((v) => v + 1);
      setRemaining(segments[index + 1].seconds);
      setRunning(false);
    }
  }
  const current = segments[index];
  return (
    <>
      <h1>{routine.title}</h1>
      <p className={styles.status}>{ru.wellness}</p>
      {!current ? (
        <p>{ru.empty}</p>
      ) : !done ? (
        <>
          <Card>
            <h2>{current.rest ? ru.rest : current.exercise.title}</h2>
            <p>
              {index + 1}/{segments.length}
            </p>
            <p className={styles.timer} role="timer">
              {Math.floor(remaining / 60)}:
              {String(remaining % 60).padStart(2, "0")}
            </p>
            <div className={styles.row}>
              <Button
                onClick={() => setRunning((v) => !v)}
                disabled={remaining === 0 || mutation.isPending}
              >
                {running ? ru.pause : ru.resume}
              </Button>
              <Button onClick={advance} disabled={mutation.isPending}>
                {index + 1 >= segments.length ? ru.finish : ru.next}
              </Button>
            </div>
          </Card>
          {!current.rest && (
            <Card>
              <ExerciseDetail exercise={current.exercise} />
            </Card>
          )}
        </>
      ) : (
        <Card>
          <p role="status">{ru.sessionDone}</p>
          <Link href="/today">{ru.today} →</Link>
        </Card>
      )}
      <p role="status">{message}</p>
    </>
  );
}
