"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Repeat2 } from "lucide-react";
import { api, type ApiPlanDay, type ApiPlanEntry, type MealSlotWert } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MEAL_SLOT_LABELS } from "@/lib/domain";
import { heute, montag, plusTage, wochentag, zeigeDatum } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Nur die beiden Hauptmahlzeiten – Snacks plant Sarah von Hand. */
const SLOTS: MealSlotWert[] = ["lunch", "dinner"];

/**
 * "Willst du das gleich einplanen?" – erscheint nach dem Anlegen eines Rezepts
 * von selbst und ist danach jederzeit über den Knopf am Rezept erreichbar.
 *
 * Belegte Slots sind nicht gesperrt, sondern austauschbar: das Konzept sieht
 * ausdrücklich vor, ein neues Rezept auch anstelle eines schon geplanten zu
 * setzen. Was ersetzt würde, steht deshalb im Knopf.
 */
export function RecipeSchedule({
  recipeId,
  titel,
  onSchliessen,
}: {
  recipeId: string;
  titel: string;
  onSchliessen: () => void;
}) {
  const [wochenstart, setWochenstart] = useState(() => montag(heute()));
  const [tage, setTage] = useState<ApiPlanDay[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erledigt, setErledigt] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);

  const laden = useCallback(async () => {
    setLaedt(true);
    try {
      const { days } = await api.plan(wochenstart, 7);
      setTage(days);
      setFehler(null);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Plan konnte nicht geladen werden.");
    } finally {
      setLaedt(false);
    }
  }, [wochenstart]);

  useEffect(() => {
    void laden();
  }, [laden]);

  /** Legt den Eintrag an – und räumt vorher weg, was im Slot stand. */
  async function einplanen(
    tag: ApiPlanDay,
    slot: MealSlotWert,
    ersetzt?: ApiPlanEntry,
  ) {
    const datum = tag.date;
    setSpeichert(true);
    try {
      if (ersetzt) {
        await api.deletePlanEntry(ersetzt.id);
      }
      await api.createPlanEntry({
        eatDate: datum,
        // Gekocht wird am selben Tag. Wer vorkochen will, verschiebt den
        // Kochtermin im Plan – daraus eine Regel zu machen hieße, Gewohnheiten
        // anzunehmen, die bei jeder Person anders sind.
        cookDate: datum,
        mealSlot: slot,
        recipeId,
        portionCount: 1,
        forWhom: ["Ich"],
        status: "confirmed",
        isAbsent: false,
      });
      setErledigt(
        `${titel} steht jetzt am ${wochentag(datum)}, ${zeigeDatum(datum)} beim ${MEAL_SLOT_LABELS[slot]}` +
          (ersetzt
            ? ` – anstelle von ${ersetzt.recipeTitle ?? ersetzt.freeText ?? "dem bisherigen Eintrag"}.`
            : "."),
      );
      setFehler(null);
      await laden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Einplanen fehlgeschlagen.");
    } finally {
      setSpeichert(false);
    }
  }

  const dieseWoche = wochenstart === montag(heute());
  const naechsteWoche = wochenstart === plusTage(montag(heute()), 7);

  return (
    <section className="rounded-xl border border-primary bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-semibold">Gleich einplanen?</h2>
          <p className="text-sm text-muted-foreground">
            Wähle einen Slot für <strong>{titel}</strong>. Belegte Slots kannst du
            ersetzen – das alte Rezept wird dann aus dem Plan genommen.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onSchliessen}>
          Später
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWochenstart(plusTage(wochenstart, -7))}
          aria-label="Eine Woche zurück"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          size="sm"
          variant={dieseWoche ? "default" : "ghost"}
          onClick={() => setWochenstart(montag(heute()))}
        >
          Diese Woche
        </Button>
        <Button
          size="sm"
          variant={naechsteWoche ? "default" : "ghost"}
          onClick={() => setWochenstart(plusTage(montag(heute()), 7))}
        >
          Nächste Woche
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWochenstart(plusTage(wochenstart, 7))}
          aria-label="Eine Woche vor"
        >
          <ChevronRight className="size-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          ab {zeigeDatum(wochenstart)}
        </span>
      </div>

      {fehler ? <p className="mb-2 text-sm text-destructive">{fehler}</p> : null}
      {erledigt ? (
        <p className="mb-2 rounded-lg border border-border bg-accent px-3 py-2 text-sm">
          {erledigt}
        </p>
      ) : null}

      {laedt ? (
        <p className="text-sm text-muted-foreground">Einen Moment …</p>
      ) : (
        <ul className="space-y-1.5">
          {tage.map((tag) => (
            <li
              key={tag.date}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2"
            >
              <span className="w-28 shrink-0 text-sm">
                <strong>{wochentag(tag.date)}</strong>
                <span className="block text-xs text-muted-foreground">
                  {zeigeDatum(tag.date)}
                </span>
                {tag.holiday ? (
                  <span className="block text-xs text-(--terracotta)">
                    {tag.holiday}
                  </span>
                ) : null}
              </span>

              <div className="flex flex-1 flex-wrap gap-1.5">
                {SLOTS.map((slot) => {
                  const belegt = tag.entries.find((e) => e.mealSlot === slot);
                  const schonDieses = belegt?.recipeId === recipeId;

                  return (
                    <Button
                      key={slot}
                      size="sm"
                      variant={belegt ? "outline" : "ghost"}
                      disabled={speichert || schonDieses}
                      className={cn(
                        "justify-start text-left",
                        schonDieses && "border-primary opacity-100",
                      )}
                      onClick={() => void einplanen(tag, slot, belegt)}
                    >
                      {belegt ? (
                        <Repeat2 className="size-4 shrink-0" aria-hidden="true" />
                      ) : null}
                      <span className="truncate">
                        {MEAL_SLOT_LABELS[slot]}
                        {schonDieses
                          ? " · steht schon"
                          : belegt
                            ? ` · statt ${belegt.recipeTitle ?? belegt.freeText ?? "Eintrag"}`
                            : " · frei"}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Gekocht wird am selben Tag. Zum Vorkochen den Kochtermin danach im Plan
        verschieben.
      </p>
    </section>
  );
}
