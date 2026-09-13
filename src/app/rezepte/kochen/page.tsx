"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CookTimer } from "@/components/cook-timer";
import { StarRating } from "@/components/star-rating";
import { api, type ApiRecipe } from "@/lib/api";
import { skaliereMenge, zeigeMenge } from "@/lib/portions";
import { cn } from "@/lib/utils";

function Inhalt() {
  const parameter = useSearchParams();
  const id = parameter.get("id");
  // Aus dem Plan heraus kommt die geplante Portionszahl mit – gekocht wird
  // für so viele, wie eingeplant sind, nicht für die Vorgabe des Rezepts.
  const geplantePortionen = Number(parameter.get("portionen")) || null;

  const [rezept, setRezept] = useState<ApiRecipe | null>(null);
  const [schritt, setSchritt] = useState(0);
  const [portionen, setPortionen] = useState(2);
  const [erledigt, setErledigt] = useState<Set<number>>(new Set());
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [bewertetGerade, setBewertetGerade] = useState(false);

  const laden = useCallback(async () => {
    if (!id) {
      setFehler("Kein Rezept angegeben.");
      setLaedt(false);
      return;
    }
    try {
      const { recipe } = await api.recipe(id);
      setRezept(recipe);
      setPortionen(geplantePortionen ?? recipe.servings);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Laden fehlgeschlagen.");
    } finally {
      setLaedt(false);
    }
  }, [id, geplantePortionen]);

  useEffect(() => {
    void laden();
  }, [laden]);

  // Bildschirm wach halten – beim Kochen hat man selten eine freie Hand,
  // um das Display wieder einzuschalten.
  useEffect(() => {
    let sperre: WakeLockSentinel | null = null;
    let abgebrochen = false;

    async function anfordern() {
      try {
        sperre = await navigator.wakeLock?.request("screen");
      } catch {
        // Nicht jeder Browser kann das, und ohne ist es nur unbequemer.
      }
    }

    void anfordern();
    return () => {
      abgebrochen = true;
      void sperre?.release().catch(() => {});
      if (abgebrochen) sperre = null;
    };
  }, []);

  // Mit den Pfeiltasten durch die Schritte
  useEffect(() => {
    function taste(e: KeyboardEvent) {
      // Obergrenze aus dem Rezept selbst, nicht aus einer Variablen, die erst
      // nach den frühen Rückgaben entsteht – sonst greift die Taste ins Leere.
      const letzterIndex = rezept?.steps.length ?? 0;
      if (e.key === "ArrowRight") setSchritt((s) => Math.min(letzterIndex, s + 1));
      if (e.key === "ArrowLeft") setSchritt((s) => Math.max(0, s - 1));
    }
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [rezept]);

  if (laedt) return <p className="text-muted-foreground">Einen Moment …</p>;

  if (!rezept) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{fehler ?? "Rezept nicht gefunden."}</p>
        <Button render={<Link href="/rezepte/" />}>Zur Rezeptliste</Button>
      </div>
    );
  }

  const schritte = rezept.steps;
  // Ein Schritt hinter dem letzten liegt der Schlussbildschirm.
  const fertig = schritt >= schritte.length;
  const aktuell = fertig ? null : schritte[schritt];
  const letzter = schritt === schritte.length - 1;

  async function bewerten(wert: number | null) {
    try {
      const { recipe } = await api.rateRecipe(rezept!.id, wert, rezept!.comment ?? "");
      setRezept(recipe);
      setBewertetGerade(true);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">{rezept.title}</h1>
          <p className="text-sm text-muted-foreground">
            {fertig
              ? "Fertig gekocht"
              : `Schritt ${schritt + 1} von ${schritte.length}`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/rezepte/ansicht/?id=${rezept.id}`} />}
          aria-label="Kochmodus verlassen"
        >
          <X className="size-4" />
          Beenden
        </Button>
      </div>

      {/* Fortschritt */}
      <div className="flex gap-1" aria-hidden="true">
        {schritte.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              fertig || i < schritt
                ? "bg-primary"
                : i === schritt
                  ? "bg-primary/60"
                  : "bg-muted",
            )}
          />
        ))}
      </div>

      {/* Portionen */}
      <div className={cn("flex items-center gap-3 rounded-xl border border-border bg-card p-3", fertig && "hidden")}>
        <span className="text-sm font-medium">Portionen</span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPortionen((p) => Math.max(0.5, p - 0.5))}
            aria-label="Eine halbe Portion weniger"
          >
            <Minus className="size-4" />
          </Button>
          <span className="w-8 text-center text-lg font-semibold tabular-nums">
            {portionen}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPortionen((p) => Math.min(99, p + 0.5))}
            aria-label="Eine halbe Portion mehr"
          >
            <Plus className="size-4" />
          </Button>
        </div>
        {portionen !== rezept.servings ? (
          <span className="text-sm text-muted-foreground">
            Mengen umgerechnet von {rezept.servings}
          </span>
        ) : null}
      </div>

      {/* Zutaten, mitlaufend skaliert */}
      {rezept.ingredients.length > 0 && !fertig ? (
        <details className="rounded-xl border border-border bg-card" open>
          <summary className="cursor-pointer p-3 font-medium">Zutaten</summary>
          <ul className="divide-y divide-border border-t border-border">
            {rezept.ingredients.map((z, i) => (
              <li key={z.id ?? i} className="flex gap-3 p-3">
                <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                  {zeigeMenge(skaliereMenge(z.amount, rezept.servings, portionen))}{" "}
                  {z.unit ?? ""}
                </span>
                <span>{z.name}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Schlussbildschirm */}
      {fertig ? (
        <section className="space-y-6 rounded-xl border border-primary/40 bg-primary/5 p-8 text-center">
          <div className="space-y-3">
            <span
              aria-hidden="true"
              className="mx-auto grid size-14 place-items-center rounded-full bg-primary text-primary-foreground"
            >
              <Check className="size-7" />
            </span>
            <h2 className="font-heading text-2xl font-semibold">Fertig gekocht</h2>
            <p className="mx-auto max-w-sm text-muted-foreground">
              {rezept.title} ist durch — {portionen}{" "}
              {portionen === 1 ? "Portion" : "Portionen"}. Lass es dir schmecken.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              {rezept.rating !== null
                ? bewertetGerade
                  ? "Gespeichert."
                  : "Deine Bewertung"
                : "Wie war es?"}
            </p>
            <div className="flex justify-center">
              <StarRating value={rezept.rating} onChange={(w) => void bewerten(w)} />
            </div>
            <p className="text-sm text-muted-foreground">
              Hilft später beim Vorschlagen — du kannst es auch überspringen.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Button render={<Link href={`/rezepte/ansicht/?id=${rezept.id}`} />}>
              Zum Rezept
            </Button>
            <Button variant="outline" render={<Link href="/rezepte/" />}>
              Zur Sammlung
            </Button>
            <Button variant="ghost" onClick={() => setSchritt(schritte.length - 1)}>
              Zurück zum letzten Schritt
            </Button>
          </div>
        </section>
      ) : null}

      {/* Aktueller Schritt */}
      {aktuell ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <button
            type="button"
            onClick={() =>
              setErledigt((alt) => {
                const neu = new Set(alt);
                if (neu.has(schritt)) neu.delete(schritt);
                else neu.add(schritt);
                return neu;
              })
            }
            className="flex w-full items-start gap-3 text-left"
            aria-pressed={erledigt.has(schritt)}
          >
            <span
              className={cn(
                "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold",
                erledigt.has(schritt)
                  ? "bg-primary text-primary-foreground"
                  : "border-2 border-border",
              )}
              aria-hidden="true"
            >
              {erledigt.has(schritt) ? "✓" : schritt + 1}
            </span>
            <span className="space-y-1">
              {aktuell.title ? (
                <span className="block font-heading text-xl font-semibold">
                  {aktuell.title}
                </span>
              ) : null}
              <span
                className={cn(
                  "block text-lg leading-relaxed",
                  erledigt.has(schritt) && "text-muted-foreground line-through",
                )}
              >
                {aktuell.content}
              </span>
            </span>
          </button>

          {aktuell.timerSeconds ? <CookTimer sekunden={aktuell.timerSeconds} /> : null}
        </section>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
          Für dieses Rezept sind keine Zubereitungsschritte hinterlegt.
        </p>
      )}

      {/* Blättern – auf dem Schlussbildschirm nicht mehr nötig */}
      {!fertig ? (
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={schritt === 0}
            onClick={() => setSchritt((s) => Math.max(0, s - 1))}
          >
            <ChevronLeft className="size-4" />
            Zurück
          </Button>
          <Button className="flex-1" onClick={() => setSchritt((s) => s + 1)}>
            {letzter ? (
              <>
                <Check className="size-4" />
                Fertig
              </>
            ) : (
              <>
                Weiter
                <ChevronRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default function KochmodusPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Einen Moment …</p>}>
      <Inhalt />
    </Suspense>
  );
}
