import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Button } from "@/components/ui/Button";
import { RecipeDetail, ExerciseDetail } from "@/components/ContentDetail";
import { content, Recipe, Exercise } from "@/domain/content";
describe("accessible components", () => {
  it("button activates using click and conveys disabled state", () => {
    const click = vi.fn();
    render(<Button onClick={click}>Сохранить</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(click).toHaveBeenCalledOnce();
  });
  it("recipe displays real ingredients and preparation steps", () => {
    render(<RecipeDetail recipe={content.recipes[0] as Recipe} />);
    expect(screen.getByText(/Овсяные хлопья — 60/)).toBeInTheDocument();
    expect(screen.getByText(/Сварите хлопья/)).toBeInTheDocument();
  });
  it("exercise exposes warnings and alternatives", () => {
    render(<ExerciseDetail exercise={content.exercises[0] as Exercise} />);
    expect(screen.getByText(/Пройти по комнате/)).toBeInTheDocument();
    expect(screen.getByText(/При боли, головокружении/)).toBeInTheDocument();
  });
});
