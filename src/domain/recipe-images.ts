import images from "./recipe-images.json";
import type { Recipe } from "./content";

/** Authored catalog images are used only while the pictured recipe still matches. */
export function recipeImageSource(recipe: Recipe): string | null {
  if (recipe.image_url) return recipe.image_url;
  const image = images[recipe.id as keyof typeof images];
  const signature = JSON.stringify([
    recipe.title,
    recipe.ingredients.map((i) => [i.name, i.quantity, i.unit]),
    recipe.instructions,
  ]);
  return image?.signature === signature ? image.src : null;
}

export function recipeWithImage(recipe: Recipe, origin: string): Recipe {
  const src = recipeImageSource(recipe);
  return { ...recipe, image_url: src ? new URL(src, origin).href : null };
}
