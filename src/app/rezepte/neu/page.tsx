"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecipeForm } from "@/components/recipe-form";

/**
 * Anlegen und Bearbeiten teilen sich diese Seite. Ohne `?id=` entsteht ein
 * neues Rezept, mit `?id=` wird das vorhandene geändert.
 *
 * Die Kennung steht in der Adresszeile statt im Pfad, weil ein statischer
 * Export nur Seiten ausliefern kann, die beim Bauen schon bekannt sind – und
 * Rezepte entstehen erst im Betrieb.
 */
function Inhalt() {
  const id = useSearchParams().get("id") ?? undefined;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" render={<Link href="/rezepte/" />}>
        <ArrowLeft className="size-4" />
        Zurück zu den Rezepten
      </Button>

      <h1 className="text-3xl">{id ? "Rezept bearbeiten" : "Neues Rezept"}</h1>

      <RecipeForm recipeId={id} />
    </div>
  );
}

export default function NeuesRezeptPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Einen Moment …</p>}>
      <Inhalt />
    </Suspense>
  );
}
