"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FolderCog, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecipeCard } from "@/components/recipe-card";
import { api, type ApiCategory, type ApiRecipeSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function RezeptePage() {
  const [rezepte, setRezepte] = useState<ApiRecipeSummary[]>([]);
  const [kategorien, setKategorien] = useState<ApiCategory[]>([]);
  const [suche, setSuche] = useState("");
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    try {
      const [r, k] = await Promise.all([api.recipes(), api.categories()]);
      setRezepte(r.recipes);
      setKategorien(k.categories);
      setFehler(null);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Laden fehlgeschlagen.");
    } finally {
      setLaedt(false);
    }
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  // Suche greift auf Titel und Kategorienamen – die Volltextsuche über
  // Zutaten kommt mit den übrigen Filtern in Phase 3.
  const begriff = suche.trim().toLowerCase();
  const gefiltert = rezepte.filter((r) => {
    const passtKategorie = !gewaehlt || r.categories.some((k) => k.id === gewaehlt);
    const passtSuche =
      begriff === "" ||
      r.title.toLowerCase().includes(begriff) ||
      r.categories.some((k) => k.name.toLowerCase().includes(begriff));
    return passtKategorie && passtSuche;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl">Rezepte</h1>
          <p className="text-muted-foreground">
            {rezepte.length === 0
              ? "Noch keine Rezepte."
              : `${rezepte.length} ${rezepte.length === 1 ? "Rezept" : "Rezepte"} in deiner Sammlung.`}
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

      {rezepte.length > 0 ? (
        <div className="space-y-3">
          <Input
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Nach Titel oder Kategorie suchen"
            aria-label="Rezepte durchsuchen"
          />

          {kategorien.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <FilterKnopf
                aktiv={gewaehlt === null}
                onClick={() => setGewaehlt(null)}
              >
                Alle
              </FilterKnopf>
              {kategorien.map((k) => (
                <FilterKnopf
                  key={k.id}
                  aktiv={gewaehlt === k.id}
                  onClick={() => setGewaehlt(gewaehlt === k.id ? null : k.id)}
                >
                  {k.name}
                  <span className="ml-1.5 opacity-60">{k.recipeCount ?? 0}</span>
                </FilterKnopf>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {laedt ? (
        <p className="text-muted-foreground">Einen Moment …</p>
      ) : rezepte.length === 0 ? (
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
      ) : gefiltert.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
          Dazu passt kein Rezept.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {gefiltert.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterKnopf({
  aktiv,
  onClick,
  children,
}: {
  aktiv: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktiv}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        aktiv
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
