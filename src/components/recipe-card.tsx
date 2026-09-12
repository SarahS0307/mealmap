"use client";

import Link from "next/link";
import { Snowflake, Timer } from "lucide-react";
import { StarRating } from "@/components/star-rating";
import type { ApiRecipeSummary } from "@/lib/api";

export function RecipeCard({ recipe }: { recipe: ApiRecipeSummary }) {
  return (
    <Link
      href={`/rezepte/ansicht/?id=${recipe.id}`}
      className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent"
    >
      <h2 className="font-heading text-lg font-semibold">{recipe.title}</h2>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <StarRating value={recipe.rating} size="sm" />
        {recipe.prepMinutes ? (
          <span className="inline-flex items-center gap-1">
            <Timer className="size-4" aria-hidden="true" />
            {recipe.prepMinutes} Min
          </span>
        ) : null}
        {recipe.freezable ? (
          <span className="inline-flex items-center gap-1">
            <Snowflake className="size-4" aria-hidden="true" />
            einfrierbar
          </span>
        ) : null}
        <span>
          {recipe.servings} {recipe.servings === 1 ? "Portion" : "Portionen"}
        </span>
      </div>

      {recipe.categories.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {recipe.categories.map((k) => (
            <span
              key={k.id}
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {k.name}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
