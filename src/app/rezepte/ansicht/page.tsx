"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarPlus, ChefHat, Minus, Pencil, Plus, Printer, Snowflake, Timer, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/star-rating";
import { RecipeAdjust } from "@/components/recipe-adjust";
import { RecipeSchedule } from "@/components/recipe-schedule";
import { RecipeSource } from "@/components/recipe-source";
import { skaliereMenge, zeigeMenge } from "@/lib/portions";
import { api, type ApiRecipe } from "@/lib/api";

function Inhalt() {
  const router = useRouter();
  const parameter = useSearchParams();
  const id = parameter.get("id");
  // Nach dem Anlegen steht ?neu=1 in der Adresse – dann geht das Einplanen
  // von selbst auf, statt dass Sarah es suchen muss.
  const frischAngelegt = parameter.get("neu") === "1";

  const [rezept, setRezept] = useState<ApiRecipe | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [kommentar, setKommentar] = useState("");
  const [bewertungOffen, setBewertungOffen] = useState(false);
  const [loeschenOffen, setLoeschenOffen] = useState(false);
  const [aendernOffen, setAendernOffen] = useState(false);
  const [einplanenOffen, setEinplanenOffen] = useState(frischAngelegt);
  // Portionen lassen sich in der Ansicht umrechnen, ohne das Rezept zu ändern.
  const [portionen, setPortionen] = useState<number | null>(null);

  const laden = useCallback(async () => {
    if (!id) {
      setFehler("Kein Rezept angegeben.");
      setLaedt(false);
      return;
    }
    try {
      const { recipe } = await api.recipe(id);
      setRezept(recipe);
      setKommentar(recipe.comment ?? "");
      setPortionen(recipe.servings);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Laden fehlgeschlagen.");
    } finally {
      setLaedt(false);
    }
  }, [id]);

  useEffect(() => {
    void laden();
  }, [laden]);

  async function bewerten(wert: number | null) {
    if (!rezept) return;
    try {
      const { recipe } = await api.rateRecipe(rezept.id, wert, kommentar);
      setRezept(recipe);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  }

  async function kommentarSpeichern() {
    if (!rezept) return;
    try {
      const { recipe } = await api.rateRecipe(rezept.id, rezept.rating, kommentar);
      setRezept(recipe);
      setBewertungOffen(false);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  }

  async function loeschen() {
    if (!rezept) return;
    try {
      await api.deleteRecipe(rezept.id);
      router.push("/rezepte/");
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    }
  }

  if (laedt) return <p className="text-muted-foreground">Einen Moment …</p>;

  if (!rezept) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{fehler ?? "Rezept nicht gefunden."}</p>
        <Button render={<Link href="/rezepte/" />}>Zur Rezeptliste</Button>
      </div>
    );
  }

  const anzeigePortionen = portionen ?? rezept.servings;

  return (
    <div className="space-y-8">
      <div data-print="aus">
        <Button variant="ghost" size="sm" render={<Link href="/rezepte/" />}>
          <ArrowLeft className="size-4" />
          Zurück zu den Rezepten
        </Button>
      </div>

      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl">{rezept.title}</h1>
          <div className="flex flex-wrap gap-2" data-print="aus">
            {rezept.steps.length > 0 ? (
              <Button
                size="sm"
                render={<Link href={`/rezepte/kochen/?id=${rezept.id}`} />}
              >
                <ChefHat className="size-4" />
                Kochmodus
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEinplanenOffen((o) => !o)}
            >
              <CalendarPlus className="size-4" />
              Einplanen
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAendernOffen(true)}>
              <Wand2 className="size-4" />
              Ändern
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              aria-label="Rezept drucken oder als PDF sichern"
            >
              <Printer className="size-4" />
              Drucken
            </Button>
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/rezepte/neu/?id=${rezept.id}`} />}
            >
              <Pencil className="size-4" />
              Bearbeiten
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLoeschenOffen(true)}
              aria-label="Rezept löschen"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span>
            {rezept.servings} {rezept.servings === 1 ? "Portion" : "Portionen"}
          </span>
          {rezept.prepMinutes ? (
            <span className="inline-flex items-center gap-1">
              <Timer className="size-4" aria-hidden="true" />
              {rezept.prepMinutes} Minuten
            </span>
          ) : null}
          {rezept.freezable ? (
            <span className="inline-flex items-center gap-1">
              <Snowflake className="size-4" aria-hidden="true" />
              einfrierbar
            </span>
          ) : null}
        </div>

        {rezept.categories.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {rezept.categories.map((k) => (
              <span
                key={k.id}
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
              >
                {k.name}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      {einplanenOffen ? (
        <div data-print="aus">
          <RecipeSchedule
            recipeId={rezept.id}
            titel={rezept.title}
            onSchliessen={() => setEinplanenOffen(false)}
          />
        </div>
      ) : null}

      {rezept.images.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {rezept.images.map((b) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={b.id}
              src={b.url}
              alt=""
              className="max-h-72 rounded-xl border border-border object-cover"
            />
          ))}
        </div>
      ) : null}

      {rezept.sourceUrl ? (
        <RecipeSource url={rezept.sourceUrl} type={rezept.sourceType} />
      ) : null}

      <RecipeAdjust
        recipe={rezept}
        offen={aendernOffen}
        onClose={() => setAendernOffen(false)}
        onChanged={setRezept}
      />

      {loeschenOffen ? (
        <div className="rounded-xl border border-(--amber) bg-card p-5">
          <p className="font-medium">„{rezept.title}“ löschen?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Das Rezept wandert in den Papierkorb und bleibt dort 30 Tage lang
            wiederherstellbar – mit Zutaten, Zubereitung und Bewertung.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="destructive" onClick={() => void loeschen()}>
              In den Papierkorb
            </Button>
            <Button variant="ghost" onClick={() => setLoeschenOffen(false)}>
              Abbrechen
            </Button>
          </div>
        </div>
      ) : null}

      {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}

      {rezept.ingredients.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-xl font-semibold">Zutaten</h2>
            <div className="flex items-center gap-2" data-print="aus">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPortionen((p) => Math.max(1, (p ?? rezept.servings) - 1))}
                aria-label="Eine Portion weniger"
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-24 text-center text-sm tabular-nums">
                {anzeigePortionen} {anzeigePortionen === 1 ? "Portion" : "Portionen"}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPortionen((p) => Math.min(99, (p ?? rezept.servings) + 1))}
                aria-label="Eine Portion mehr"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
          {anzeigePortionen !== rezept.servings ? (
            <p className="text-sm text-muted-foreground" data-print="aus">
              Mengen umgerechnet von {rezept.servings}. Das Rezept selbst bleibt
              unverändert.
            </p>
          ) : null}
          {/* Auf dem Ausdruck steht die Portionszahl als Text, weil der
              Regler dort nichts verloren hat. */}
          <p className="text-sm" data-print="nur">
            Für {anzeigePortionen} {anzeigePortionen === 1 ? "Portion" : "Portionen"}
          </p>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {rezept.ingredients.map((z, i) => (
              <li key={z.id ?? i} className="flex gap-3 p-3">
                <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                  {zeigeMenge(skaliereMenge(z.amount, rezept.servings, anzeigePortionen))}{" "}
                  {z.unit ?? ""}
                </span>
                <span>{z.name}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rezept.steps.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold">Zubereitung</h2>
          <ol className="space-y-3">
            {rezept.steps.map((s, i) => (
              <li key={s.id ?? i} className="flex gap-3 rounded-xl border border-border bg-card p-4">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <div className="space-y-1">
                  {s.title ? <p className="font-medium">{s.title}</p> : null}
                  <p className="text-muted-foreground">{s.content}</p>
                  {s.timerSeconds ? (
                    <p className="inline-flex items-center gap-1 text-sm text-(--terracotta)">
                      <Timer className="size-4" aria-hidden="true" />
                      {Math.round(s.timerSeconds / 60)} Minuten
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {rezept.notes ? (
        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold">Notiz</h2>
          <p className="rounded-xl border border-border bg-card p-4 whitespace-pre-line">
            {rezept.notes}
          </p>
        </section>
      ) : null}

      <section className="space-y-3" data-print="aus">
        <h2 className="font-heading text-xl font-semibold">Bewertung</h2>
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <StarRating value={rezept.rating} onChange={(w) => void bewerten(w)} />

          {bewertungOffen ? (
            <div className="space-y-2">
              <Textarea
                value={kommentar}
                onChange={(e) => setKommentar(e.target.value)}
                placeholder="Was ist dir aufgefallen?"
                rows={3}
                aria-label="Kommentar zur Bewertung"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void kommentarSpeichern()}>
                  Speichern
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setKommentar(rezept.comment ?? "");
                    setBewertungOffen(false);
                  }}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : rezept.comment ? (
            <div className="space-y-2">
              <p className="whitespace-pre-line text-muted-foreground">{rezept.comment}</p>
              <Button size="sm" variant="ghost" onClick={() => setBewertungOffen(true)}>
                Kommentar ändern
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setBewertungOffen(true)}>
              Kommentar hinzufügen
            </Button>
          )}
        </div>
      </section>
      {/* Nur auf dem Ausdruck: Herkunft des Blattes. */}
      <p
        data-print="nur"
        className="mt-8 border-t border-border pt-3 text-xs text-muted-foreground"
      >
        {rezept.title} · aus MealMap
      </p>
    </div>
  );
}

export default function RezeptAnsichtPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Einen Moment …</p>}>
      <Inhalt />
    </Suspense>
  );
}
