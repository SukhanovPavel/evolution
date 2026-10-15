"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { data } from "@/lib/data";
import { ru } from "@/i18n/ru";
import { Recipe, Exercise } from "@/domain/content";
import { QueryState } from "./QueryState";
import { RecipeImage } from "./RecipeImage";
import styles from "./App.module.css";
export function RecipeDetail({ recipe }: { recipe: Recipe }) {
  return (
    <div className={styles.stack}>
      <RecipeImage recipe={recipe} />
      <p>{recipe.description}</p>
      <p className={styles.tag}>
        {recipe.prep_minutes} {ru.minutes} · {recipe.servings} {ru.servings}
      </p>
      <div>
        <h3>{ru.ingredients}</h3>
        <ul>
          {recipe.ingredients.map((i) => (
            <li key={i.name}>
              {i.name} — {i.quantity} {i.unit}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3>{ru.instructions}</h3>
        <ol>
          {recipe.instructions.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
      {recipe.allergens.length > 0 && (
        <p>
          {ru.allergies}: {recipe.allergens.join(", ")}
        </p>
      )}
      <p className={styles.muted}>{recipe.nutrition_notes}</p>
    </div>
  );
}
export function ExerciseDetail({ exercise }: { exercise: Exercise }) {
  return (
    <div className={styles.stack}>
      <p>{exercise.description}</p>
      <div>
        <h3>{ru.technique}</h3>
        <ol>
          {exercise.instructions.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </div>
      <p>
        {exercise.reps} {ru.repetitions} · {exercise.seconds} {ru.seconds}
      </p>
      <p>
        <strong>{ru.mistakes}: </strong>
        {exercise.common_mistakes}
      </p>
      <p>
        <strong>{ru.easier}: </strong>
        {exercise.easier}
      </p>
      <p>
        <strong>{ru.harder}: </strong>
        {exercise.harder}
      </p>
      <p className={styles.status}>{exercise.warnings}</p>
      {exercise.media_url && (
        <a href={exercise.media_url} target="_blank" rel="noreferrer">
          {ru.details}
        </a>
      )}
    </div>
  );
}
export function ContentDetail({
  type,
  id,
}: {
  type: string | null;
  id: string | null;
}) {
  const recipes = useQuery({
    queryKey: ["recipes"],
    queryFn: () => data.recipes(),
    enabled: type === "recipe",
  });
  const exercises = useQuery({
    queryKey: ["exercises"],
    queryFn: data.exercises,
    enabled: type === "exercise",
  });
  const routines = useQuery({
    queryKey: ["routines"],
    queryFn: data.routines,
    enabled: type === "routine",
  });
  if (!id) return null;
  const query =
    type === "recipe" ? recipes : type === "exercise" ? exercises : routines;
  const recipe = recipes.data?.find((v) => v.id === id),
    exercise = exercises.data?.find((v) => v.id === id),
    routine = routines.data?.find((v) => v.id === id);
  return (
    <>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => query.refetch()}
      />
      {recipe && <RecipeDetail recipe={recipe} />}
      {exercise && <ExerciseDetail exercise={exercise} />}
      {routine && (
        <>
          <h3>{routine.title}</h3>
          <Link href={`/movement/${routine.slug}`}>{ru.play} →</Link>
        </>
      )}
    </>
  );
}
