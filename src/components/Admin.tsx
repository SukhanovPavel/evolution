"use client";
import { Textarea } from "./ui/Fields";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, request } from "@/lib/api-client";
import { configured } from "@/lib/supabase/browser";
import { content } from "@/domain/content";
import { ru } from "@/i18n/ru";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Modal } from "./Modal";
import { QueryState } from "./QueryState";
import styles from "./App.module.css";
type Row = {
  id: string;
  title: string;
  active?: boolean;
  published?: boolean;
  program_template_tasks?: unknown[];
  [key: string]: unknown;
};
export function Admin() {
  const [table, setTable] = useState("recipes");
  const [editing, setEditing] = useState<{ id?: string; text: string } | null>(
    null,
  );
  const me = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    enabled: configured,
  });
  const query = useQuery({
    queryKey: ["admin", table],
    queryFn: () => request<Row[]>(`admin/${table}?limit=100`),
    enabled: configured && me.data?.role === "admin",
  });
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({
      id,
      text,
      deactivate,
    }: {
      id?: string;
      text?: string;
      deactivate?: boolean;
    }) => {
      return request(`admin/${table}${id ? `/${id}` : ""}`, {
        method: deactivate ? "DELETE" : id ? "PATCH" : "POST",
        body: JSON.stringify(text ? JSON.parse(text) : {}),
      });
    },
    onSuccess: () => {
      setEditing(null);
      cache.invalidateQueries({ queryKey: ["admin"] });
      cache.invalidateQueries({ queryKey: [table] });
    },
  });
  function newRow() {
    const source =
      table === "recipes"
        ? content.recipes[0]
        : table === "exercises"
          ? content.exercises[0]
          : {
              ...content.program_templates[0],
              tasks: content.program_template_tasks.filter(
                (t) =>
                  t.program_template_id === content.program_templates[0].id,
              ),
            };
    const value = { ...source, id: undefined, slug: "new-content" };
    setEditing({ text: JSON.stringify(value, null, 2) });
  }
  if (!configured)
    return (
      <>
        <h1>{ru.admin}</h1>
        <p>{ru.missingConfig}</p>
      </>
    );
  if (me.isPending) return <p>{ru.loading}</p>;
  if (me.data?.role !== "admin") return <p role="alert">{ru.adminDenied}</p>;
  return (
    <div className={styles.stack}>
      <h1>{ru.admin}</h1>
      <p>{ru.adminHelp}</p>
      <div className={styles.tabs}>
        {["recipes", "exercises", "program_templates"].map((t) => (
          <button
            key={t}
            className={table === t ? styles.selected : ""}
            onClick={() => setTable(t)}
          >
            {t === "program_templates"
              ? ru.program
              : ru[t as "recipes" | "exercises"]}
          </button>
        ))}
      </div>
      <Button onClick={newRow}>{ru.create}</Button>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => query.refetch()}
      />
      {query.data?.map((row) => (
        <Card key={row.id}>
          <h2>{row.title}</h2>
          <p>
            {row.active === false || row.published === false
              ? ru.inactive
              : ru.published}
          </p>
          <div className={styles.row}>
            <Button
              onClick={() => {
                const { program_template_tasks, ...rest } = row;
                setEditing({
                  id: row.id,
                  text: JSON.stringify(
                    table === "program_templates"
                      ? { ...rest, tasks: program_template_tasks }
                      : rest,
                    null,
                    2,
                  ),
                });
              }}
            >
              {ru.edit}
            </Button>
            <Button
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ id: row.id, deactivate: true })}
            >
              {ru.deactivate}
            </Button>
          </div>
        </Card>
      ))}
      {mutation.error && <p role="alert">{ru.error}</p>}
      {editing && (
        <Modal
          title={editing.id ? ru.edit : ru.create}
          onClose={() => setEditing(null)}
        >
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate(editing);
            }}
          >
            <label>
              {ru.json}
              <Textarea
                rows={18}
                value={editing.text}
                onChange={(e) =>
                  setEditing({ ...editing, text: e.target.value })
                }
              />
            </label>
            <Button disabled={mutation.isPending}>{ru.save}</Button>
            {mutation.error && <p role="alert">{ru.error}</p>}
          </form>
        </Modal>
      )}
    </div>
  );
}
