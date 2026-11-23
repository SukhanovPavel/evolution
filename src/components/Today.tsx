"use client";
import { Input, Select, Textarea } from "./ui/Fields";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  Leaf,
  Footprints,
  Heart,
  StretchHorizontal,
} from "lucide-react";
import { data } from "@/lib/data";
import { api } from "@/lib/api-client";
import { configured } from "@/lib/supabase/browser";
import { demoProfile } from "@/lib/demo";
import { addDays, localDate } from "@/domain/dates";
import { checkinSchema } from "@/domain/schemas";
import { Task } from "@/domain/plan";
import { ru } from "@/i18n/ru";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Modal } from "./Modal";
import { QueryState } from "./QueryState";
import { ContentDetail } from "./ContentDetail";
import styles from "./App.module.css";
const icons = {
  nutrition: Leaf,
  activity: Footprints,
  stretching: StretchHorizontal,
  recovery: Heart,
};
export function Today() {
  const [selected, setSelected] = useState<Task | null>(null);
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ["plan"], queryFn: () => data.plan() });
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Task["status"] }) =>
      data.task(id, status),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ["plan"] });
      cache.invalidateQueries({ queryKey: ["progress"] });
    },
  });
  const plan = query.data;
  const tasks = plan?.daily_tasks ?? [];
  const done = tasks.filter((t) => t.status === "completed").length;
  return (
    <div className={styles.stack}>
      <div className={styles.heading}>
        <div>
          <p className={styles.muted}>{plan?.local_date}</p>
          <h1>{ru.today}</h1>
          <p className={styles.muted}>{ru.todaySub}</p>
        </div>
        <span className={styles.tag}>
          {done}/{tasks.length}
        </span>
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => query.refetch()}
      />
      {plan && (
        <>
          <Card>
            <div className={styles.heading}>
              <strong>{ru.completion}</strong>
              <span>
                {tasks.length ? Math.round((done / tasks.length) * 100) : 0}%
              </span>
            </div>
            <progress
              className={styles.progress}
              max={tasks.length || 1}
              value={done}
              aria-label={ru.completion}
            />
            <p className={styles.muted}>
              {ru.reasons[plan.adaptation_reason as keyof typeof ru.reasons] ??
                plan.adaptation_reason}{" "}
              · {tasks.reduce((s, t) => s + t.estimated_minutes, 0)}{" "}
              {ru.minutes}
            </p>
          </Card>
          <div className={styles.grid}>
            {Object.entries(ru.categories).map(([category, label]) => {
              const Icon = icons[category as keyof typeof icons];
              return (
                <Card key={category}>
                  <h2 className={styles.row}>
                    <Icon size={20} />
                    {label}
                  </h2>
                  <div className={styles.stack}>
                    {tasks
                      .filter((t) => t.category === category)
                      .map((task) => (
                        <div className={styles.task} key={task.id}>
                          <button
                            className={`${styles.check} ${task.status === "completed" ? styles.done : ""}`}
                            aria-label={`${task.status === "completed" ? ru.resetTask : ru.complete}: ${task.title}`}
                            aria-pressed={task.status === "completed"}
                            disabled={mutation.isPending}
                            onClick={() =>
                              mutation.mutate({
                                id: task.id,
                                status:
                                  task.status === "completed"
                                    ? "pending"
                                    : "completed",
                              })
                            }
                          >
                            <Check size={20} />
                          </button>
                          <div className={styles.taskBody}>
                            <h3>{task.title}</h3>
                            {task.category === "nutrition" && (
                              <p className={styles.muted}>
                                {task.description.split("\n")[0]}
                              </p>
                            )}
                            <p>
                              {task.estimated_minutes
                                ? `${task.estimated_minutes} ${ru.minutes}`
                                : ru.integrated}
                            </p>
                            <div className={styles.row}>
                              <button
                                className={styles.linkButton}
                                onClick={() => setSelected(task)}
                              >
                                {ru.details}
                              </button>
                              <button
                                className={styles.linkButton}
                                disabled={mutation.isPending}
                                onClick={() =>
                                  mutation.mutate({
                                    id: task.id,
                                    status:
                                      task.status === "skipped"
                                        ? "pending"
                                        : "skipped",
                                  })
                                }
                              >
                                {task.status === "skipped"
                                  ? ru.resetTask
                                  : ru.skip}
                              </button>
                            </div>
                            {task.status === "skipped" && (
                              <span className={styles.muted}>{ru.skipped}</span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </Card>
              );
            })}
          </div>
          <CheckinForm date={plan.local_date} />
        </>
      )}
      {mutation.error && <p role="alert">{ru.error}</p>}
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <p className={styles.multiline}>{selected.description}</p>
          <ContentDetail
            type={selected.reference_type}
            id={selected.reference_id}
          />
        </Modal>
      )}
      <p className={styles.muted}>{ru.wellness}</p>
    </div>
  );
}
function CheckinForm({ date }: { date: string }) {
  const previous = useQuery({
    queryKey: ["checkins", date],
    queryFn: () => data.checkins(date, date),
  });
  const [message, setMessage] = useState("");
  const cache = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({
    resolver: zodResolver(checkinSchema),
    values: previous.data?.[0] ?? {
      energy: 3,
      difficulty: 3,
      mood: null,
      pain_flag: false,
      illness_flag: false,
      notes: "",
    },
    defaultValues: {
      energy: 3,
      difficulty: 3,
      mood: null,
      pain_flag: false,
      illness_flag: false,
      notes: "",
    },
  });
  async function submit(value: Parameters<typeof data.checkin>[1]) {
    try {
      await data.checkin(date, value);
      setMessage(ru.saved);
      cache.invalidateQueries({ queryKey: ["progress"] });
      cache.invalidateQueries({ queryKey: ["checkins", date] });
    } catch {
      setMessage(ru.error);
    }
  }
  return (
    <Card>
      <h2>{ru.checkin}</h2>
      <p className={styles.muted}>{ru.checkinHelp}</p>
      <form className={styles.form} onSubmit={handleSubmit(submit)}>
        <div className={styles.grid}>
          {(["energy", "difficulty"] as const).map((key) => (
            <label key={key}>
              {ru[key]}
              <Select
                aria-label={ru[key]}
                aria-describedby={`${key}-help`}
                {...register(key, { valueAsNumber: true })}
              >
                {[1, 2, 3, 4, 5].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Select>
              <span id={`${key}-help`} className={styles.muted}>
                {ru.checkinHints[key]}
              </span>
            </label>
          ))}
        </div>
        <label>
          {ru.mood}
          <Select
            aria-describedby="mood-help"
            {...register("mood", {
              setValueAs: (v) => (v === "" ? null : Number(v)),
            })}
          >
            <option value="">{ru.skip}</option>
            {[1, 2, 3, 4, 5].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </Select>
        </label>
        <p id="mood-help" className={styles.muted}>
          {ru.checkinHints.mood}
        </p>
        <label className={styles.checkbox}>
          <Input type="checkbox" {...register("pain_flag")} />
          {ru.pain}
        </label>
        <label className={styles.checkbox}>
          <Input type="checkbox" {...register("illness_flag")} />
          {ru.illness}
        </label>
        <label>
          {ru.notes}
          <Textarea {...register("notes")} />
        </label>
        <Button disabled={isSubmitting}>{ru.save}</Button>
        <p role="status">{message}</p>
      </form>
    </Card>
  );
}
export function ProgramView() {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const query = useQuery({ queryKey: ["program"], queryFn: data.program });
  const me = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    enabled: configured,
  });
  const cache = useQueryClient();
  const p = query.data;
  const today = localDate(me.data?.timezone ?? demoProfile.timezone);
  const date =
    p && selectedDay ? addDays(p.start_date, selectedDay - 1) : undefined;
  const history = useQuery({
    queryKey: ["plan", date],
    queryFn: () => data.plan(date),
    enabled: Boolean(configured && date && date < today),
  });
  const continuation = useMutation({
    mutationFn: data.continueProgram,
    onSuccess: async (program) => {
      setSelectedDay(null);
      cache.setQueryData(["program"], program);
      await cache.invalidateQueries({ queryKey: ["plan"] });
    },
  });
  return (
    <div className={styles.stack}>
      <h1>{ru.program}</h1>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => query.refetch()}
      />
      {!query.isPending && !query.error && !p && (
        <Link href="/onboarding">{ru.onboarding}</Link>
      )}
      {p && (
        <>
          <Card>
            <h2>{p.program_templates.title}</h2>
            {p.status === "completed" && <p>{ru.programCompleted}</p>}
            <p className={styles.muted}>{p.start_date}</p>
            <p className={styles.muted}>{ru.programPreview}</p>
            <p>
              {ru.month.cycle} {p.cycle ?? 1} · {ru.month.guide}
            </p>
            {p.status === "completed" && (
              <Button
                disabled={continuation.isPending}
                onClick={() => continuation.mutate(p.id)}
              >
                {ru.month.continue}
              </Button>
            )}
            {(continuation.isSuccess || date === today) && (
              <Link href="/today">{ru.month.continueToday}</Link>
            )}
            {continuation.isError && <p role="alert">{ru.error}</p>}
          </Card>
          {[0, 1, 2, 3, 4].map((week) => (
            <Card key={week}>
              <h2>
                {ru.week} {week + 1}
              </h2>
              <div className={styles.calendar}>
                {Array.from({ length: Math.min(7, 30 - week * 7) }, (_, i) => {
                  const day = week * 7 + i + 1;
                  const date = new Date(`${p.start_date}T12:00:00Z`);
                  date.setUTCDate(date.getUTCDate() + day - 1);
                  const current = date.toISOString().slice(0, 10) === today;
                  return (
                    <button
                      key={day}
                      className={styles.day}
                      aria-expanded={selectedDay === day}
                      aria-controls={`program-week-${week}`}
                      onClick={() =>
                        setSelectedDay(selectedDay === day ? null : day)
                      }
                    >
                      {ru.day} {day}
                      {current ? " •" : ""}
                    </button>
                  );
                })}
              </div>
              {selectedDay !== null &&
                Math.floor((selectedDay - 1) / 7) === week && (
                  <div
                    id={`program-week-${week}`}
                    className={styles.programDay}
                  >
                    <h3>
                      {ru.day} {selectedDay}
                    </h3>
                    {history.data
                      ? history.data.daily_tasks.map((task) => (
                          <div key={task.id}>
                            <strong>
                              {task.title} · {ru[task.status]}
                            </strong>
                            <p className={styles.multiline}>
                              {task.description}
                            </p>
                          </div>
                        ))
                      : p.tasks
                          .filter((t) => t.day_number === selectedDay)
                          .map((t) => (
                            <div key={t.id}>
                              <strong>
                                {t.payload.title}
                                {t.estimated_minutes > 0 &&
                                  ` · ${t.estimated_minutes} ${ru.minutes}`}
                              </strong>
                              <p className={styles.multiline}>
                                {t.payload.description}
                              </p>
                            </div>
                          ))}
                  </div>
                )}
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
