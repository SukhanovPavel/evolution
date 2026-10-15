"use client";
import { Input, Select } from "./ui/Fields";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, ShoppingBasket } from "lucide-react";
import { data } from "@/lib/data";
import { api, request } from "@/lib/api-client";
import { configured } from "@/lib/supabase/browser";
import { demoFavorites, demoPreferences } from "@/lib/demo";
import { Recipe } from "@/domain/content";
import { safeRecipes } from "@/domain/plan";
import { ru } from "@/i18n/ru";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Modal } from "./Modal";
import { RecipeDetail } from "./ContentDetail";
import { QueryState } from "./QueryState";
import { RecipeImage } from "./RecipeImage";
import styles from "./App.module.css";
export function Nutrition() {
  const [search, setSearch] = useState("");
  const [track, setTrack] = useState("all");
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [shopping, setShopping] = useState<string[]>([]);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const query = useQuery({
    queryKey: ["recipes"],
    queryFn: () => data.recipes("limit=100"),
  });
  const preferences = useQuery({
    queryKey: ["preferences"],
    queryFn: api.preferences,
    enabled: configured,
  });
  const favorites = useQuery({
    queryKey: ["favorites"],
    queryFn: () =>
      configured
        ? request<{ recipe_id: string }[]>("favorites")
        : Promise.resolve(
            [...demoFavorites].map((recipe_id) => ({ recipe_id })),
          ),
  });
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({ id, exists }: { id: string; exists: boolean }) => {
      if (configured)
        await request(`favorites/${id}`, {
          method: exists ? "DELETE" : "PUT",
          body: "{}",
        });
      else if (exists) demoFavorites.delete(id);
      else demoFavorites.add(id);
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: ["favorites"] }),
  });
  const favoriteIds = new Set(favorites.data?.map((v) => v.recipe_id));
  const recipes = (query.data ?? [])
    .filter(
      (r) =>
        r.title.toLowerCase().includes(search.toLowerCase()) &&
        (track === "all" || r.track_tags.includes(track as "healthy")) &&
        (!favoriteOnly || favoriteIds.has(r.id)),
    )
    .filter(
      (r) =>
        (!preferences.data && !demoPreferences.food_allergies.length) ||
        safeRecipes([r], {
          ...(preferences.data ?? demoPreferences),
          nutrition_track:
            track === "all" ? r.track_tags[0] : (track as "healthy"),
        }).length > 0,
    );
  const list = useQuery({
    queryKey: ["shopping", shopping],
    enabled: shopping.length > 0,
    queryFn: async () => {
      if (configured)
        return request<Recipe["ingredients"]>(
          `shopping-list?recipe_ids=${shopping.join(",")}`,
        );
      const items = new Map<string, Recipe["ingredients"][number]>();
      for (const r of query.data ?? [])
        if (shopping.includes(r.id))
          for (const i of r.ingredients) {
            const key = i.name + i.unit;
            items.set(key, {
              ...i,
              quantity: i.quantity + (items.get(key)?.quantity ?? 0),
            });
          }
      return [...items.values()];
    },
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
      <h1>{ru.nutrition}</h1>
      <p className={styles.muted}>{ru.nutritionSafety}</p>
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
          {ru.track}
          <Select
            className={styles.input}
            value={track}
            onChange={(e) => setTrack(e.target.value)}
          >
            <option value="all">{ru.all}</option>
            {Object.entries(ru.tracks).map(([key, title]) => (
              <option key={key} value={key}>
                {title}
              </option>
            ))}
          </Select>
        </label>
        <label className={styles.checkbox}>
          <Input
            type="checkbox"
            checked={favoriteOnly}
            onChange={(e) => setFavoriteOnly(e.target.checked)}
          />
          {ru.favorites}
        </label>
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => query.refetch()}
      />
      <div className={styles.grid}>
        {recipes.map((recipe) => (
          <Card key={recipe.id}>
            <RecipeImage recipe={recipe} />
            <span className={styles.tag}>
              {recipe.prep_minutes} {ru.minutes}
            </span>
            <h2>{recipe.title}</h2>
            <p className={styles.muted}>{recipe.description}</p>
            <div className={styles.row}>
              <Button onClick={() => setSelected(recipe)}>{ru.details}</Button>
              <button
                className={styles.linkButton}
                aria-label={
                  favoriteIds.has(recipe.id) ? ru.removeFavorite : ru.favorite
                }
                aria-pressed={favoriteIds.has(recipe.id)}
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    id: recipe.id,
                    exists: favoriteIds.has(recipe.id),
                  })
                }
              >
                <Heart
                  fill={favoriteIds.has(recipe.id) ? "currentColor" : "none"}
                />
              </button>
              <button
                className={styles.linkButton}
                aria-label={ru.addShopping}
                aria-pressed={shopping.includes(recipe.id)}
                onClick={() =>
                  setShopping((v) =>
                    v.includes(recipe.id)
                      ? v.filter((id) => id !== recipe.id)
                      : [...v, recipe.id],
                  )
                }
              >
                <ShoppingBasket />
              </button>
            </div>
          </Card>
        ))}
      </div>
      {!query.isPending && !recipes.length && <p>{ru.empty}</p>}
      {mutation.error && <p role="alert">{ru.error}</p>}
      {shopping.length > 0 && (
        <Card>
          <h2>{ru.shopping}</h2>
          <QueryState
            pending={list.isPending}
            error={list.error}
            retry={() => list.refetch()}
          />
          <ul>
            {list.data?.map((i) => (
              <li key={i.name + i.unit}>
                {i.name} — {i.quantity} {i.unit}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <RecipeDetail recipe={selected} />
        </Modal>
      )}
    </div>
  );
}
