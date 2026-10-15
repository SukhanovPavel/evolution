"use client";
import Image from "next/image";
import { useState } from "react";
import type { Recipe } from "@/domain/content";
import { recipeImageSource } from "@/domain/recipe-images";
import styles from "./RecipeImage.module.css";

export function RecipeImage({ recipe }: { recipe: Recipe }) {
  const source = recipeImageSource(recipe);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!source || failedSource === source) return null;
  return (
    <Image
      className={styles.image}
      src={source}
      alt={recipe.title}
      width={768}
      height={512}
      sizes="(max-width: 700px) 100vw, 50vw"
      unoptimized={/^https?:/.test(source)}
      onError={() => setFailedSource(source)}
    />
  );
}
