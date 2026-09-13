"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FolderCog, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecipeCard } from "@/components/recipe-card";
import { RecipeFilters } from "@/components/recipe-filters";
import {
  api,
  type ApiCategory,
  type ApiRecipeSummary,
  type RecipeFilter,
} from "@/lib/api";

export default function RezeptePage() {
  const [rezepte, setRezepte] = useState<ApiRecipeSummary[]>([]);
  const [kategorien, setKategorien] = useState<ApiCategory[]>([]);
  const [filter, setFilter] = useState<RecipeFilter>({});
  const [filterOffen, setFilterOffen] = useState(false);
  const [gesamt, setGesamt] = useState<number | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  // Kategorien und Gesamtzahl einmalig – sie hängen nicht am Filter.
  useEffect(() => {
    api
      .categories()
      .then(({ categories }) => setKategorien(categories))
      .catch(() => setKategorien([]));
    api
      .recipes()
      .then(({ recipes }) => setGesamt(recipes.length))
      .catch(() => setGesamt(null));
  }, []);

  const suchen = useCallback(async (f: RecipeFilter) => {
    try {
      const { recipes } = await api.recipes(f);
      setRezepte(recipes);
      setFehler(null);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Laden fehlgeschlagen.");
    } finally {
      setLaedt(false);
    }
  }, []);

  // Beim Tippen nicht bei jedem Zeichen anfragen.
  useEffect(() => {
    const kennung = window.setTimeout(() => void suchen(filter), 250);
    return () => window.clearTimeout(kennung);
  }, [filter, suchen]);

  const gefiltert =
    Boolean(filter.q?.trim()) ||
    [filter.category, filter.freezable, filter.minRating, filter.maxMinutes].some(
      (w) => w !== null && w !== undefined,
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl">Rezepte</h1>
          <p className="text-muted-foreground">
            {gesamt === 0
              ? "Noch keine Rezepte."
              : gefiltert
                ? `${rezepte.length} von ${gesamt ?? "?"} passen`
                : `${gesamt ?? rezepte.length} ${(gesamt ?? rezepte.length) === 1 ? "Rezept" : "Rezepte"} in deiner Sammlung.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/rezepte/kategorien/" />}>
            <FolderCog className="size-4" />
            Kategorien
          </Button>
          <Button render={<Link href="/rezepte/neu/" />}>
            <Plus className="size-4" />
            Neues Rezept
          </Button>
        </div>
      </div>

      {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}

      {gesamt !== 0 ? (
        <RecipeFilters
          filter={filter}
          kategorien={kategorien}
          onChange={setFilter}
          offen={filterOffen}
          onToggle={() => setFilterOffen((o) => !o)}
        />
      ) : null}

      {laedt ? (
        <p className="text-muted-foreground">Einen Moment …</p>
      ) : gesamt === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="font-medium">Deine Sammlung ist noch leer.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Leg das erste Rezept an – Titel und Zutaten genügen für den Anfang.
          </p>
          <Button className="mt-4" render={<Link href="/rezepte/neu/" />}>
            <Plus className="size-4" />
            Erstes Rezept anlegen
          </Button>
        </div>
      ) : rezepte.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-muted-foreground">Dazu passt kein Rezept.</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setFilter({})}
          >
            Alle Filter zurücksetzen
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rezepte.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}

      {/* Bewusst am Fuß der Seite und nicht in der Hauptnavigation – der
          Papierkorb ist eine Rückversicherung, kein Arbeitsbereich. */}
      <div className="border-t border-border pt-4">
        <Button variant="ghost" size="sm" render={<Link href="/rezepte/papierkorb/" />}>
          <Trash2 className="size-4" />
          Papierkorb
        </Button>
      </div>
    </div>
  );
}
