import { describe, expect, it } from "vitest";
import { content, type Recipe } from "@/domain/content";
import { recipeImageSource, recipeWithImage } from "@/domain/recipe-images";
const recipe = content.recipes[0] as Recipe;
describe("recipe images", () => {
  it("maps all authored recipes to their own bundled image", () => {
    const sources = content.recipes.map((r) => recipeImageSource(r as Recipe));
    expect(sources).toHaveLength(24);
    expect(sources.every((src) => src?.startsWith("/images/recipes/"))).toBe(
      true,
    );
    expect(new Set(sources).size).toBe(24);
  });
  it("preserves a custom catalog image", () => {
    expect(
      recipeImageSource({
        ...recipe,
        image_url: "https://example.com/meal.webp",
      }),
    ).toBe("https://example.com/meal.webp");
  });
  it("does not show stale imagery after the ingredients or preparation change", () => {
    expect(
      recipeImageSource({
        ...recipe,
        ingredients: recipe.ingredients.slice(1),
      }),
    ).toBeNull();
    expect(
      recipeImageSource({ ...recipe, instructions: ["Другое блюдо"] }),
    ).toBeNull();
  });
  it("returns an absolute asset URL for API and future mobile clients", () => {
    expect(recipeWithImage(recipe, "https://evolution.example").image_url).toBe(
      "https://evolution.example/images/recipes/recipe-1.webp",
    );
  });
});
