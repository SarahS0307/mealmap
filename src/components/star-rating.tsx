"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type StarRatingProps = {
  value: number | null;
  onChange?: (wert: number | null) => void;
  size?: "sm" | "md";
};

/**
 * Sternebewertung von 1 bis 5. Ohne `onChange` nur zur Anzeige.
 * Ein Klick auf den bereits gesetzten Stern nimmt die Bewertung zurück.
 */
export function StarRating({ value, onChange, size = "md" }: StarRatingProps) {
  const klasse = size === "sm" ? "size-4" : "size-6";

  if (!onChange) {
    return (
      <span
        className="inline-flex items-center gap-0.5"
        aria-label={value ? `${value} von 5 Sternen` : "Nicht bewertet"}
      >
        {[1, 2, 3, 4, 5].map((stern) => (
          <Star
            key={stern}
            aria-hidden="true"
            className={cn(
              klasse,
              value !== null && stern <= value
                ? "fill-(--mustard) text-(--mustard)"
                : "text-muted-foreground/40",
            )}
          />
        ))}
      </span>
    );
  }

  return (
    <span role="radiogroup" aria-label="Bewertung" className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((stern) => (
        <button
          key={stern}
          type="button"
          role="radio"
          aria-checked={value === stern}
          aria-label={`${stern} von 5 Sternen`}
          onClick={() => onChange(value === stern ? null : stern)}
          className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Star
            className={cn(
              klasse,
              value !== null && stern <= value
                ? "fill-(--mustard) text-(--mustard)"
                : "text-muted-foreground/40",
            )}
          />
        </button>
      ))}
    </span>
  );
}
