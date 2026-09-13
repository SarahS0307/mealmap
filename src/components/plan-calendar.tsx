"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ShoppingCart } from "lucide-react";
import type { ApiPlanDay, ApiPlanEntry, MealSlotWert } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MEAL_SLOTS, MEAL_SLOT_LABELS } from "@/lib/domain";
import {
  heute,
  istVergangen,
  spalte,
  tageImMonat,
  wochentag,
  zeigeDatum,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

const WOCHENKOPF = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Kurzform für die enge Zelle. */
const SLOT_KURZ: Record<MealSlotWert, string> = {
  breakfast: "Frühstück",
  snack_am: "Snack",
  lunch: "Mittag",
  snack_pm: "Snack",
  dinner: "Abend",
  other: "Sonstiges",
};

/** Farbe je Slot – dieselbe Zuordnung wie in der Tagesansicht. */
const SLOT_FARBE: Record<MealSlotWert, string> = {
  breakfast: "bg-(--slot-breakfast) text-(--slot-breakfast-foreground)",
  snack_am: "bg-(--slot-snack) text-(--slot-snack-foreground)",
  lunch: "bg-(--slot-lunch) text-(--slot-lunch-foreground)",
  snack_pm: "bg-(--slot-snack) text-(--slot-snack-foreground)",
  dinner: "bg-(--slot-dinner) text-(--slot-dinner-foreground)",
  other: "bg-muted text-muted-foreground",
};

/** Nur der Farbwert, für die Punkte im schmalen Raster. */
const SLOT_PUNKT: Record<MealSlotWert, string> = {
  breakfast: "bg-(--slot-breakfast)",
  snack_am: "bg-(--slot-snack)",
  lunch: "bg-(--slot-lunch)",
  snack_pm: "bg-(--slot-snack)",
  dinner: "bg-(--slot-dinner)",
  other: "bg-muted-foreground/40",
};

/** Der Zustand eines Eintrags als Wort – das ist die eigentliche Beschriftung. */
function zustand(e: ApiPlanEntry): string {
  if (e.isAbsent) return "nicht da";
  if (e.eatenAt) return "gegessen";
  if (e.cookedAt) return "gekocht";
  return e.status === "suggested" ? "vorgeschlagen" : "geplant";
}

/** Einträge eines Tages in der Reihenfolge der Mahlzeiten. */
function sortiert(tag: ApiPlanDay | undefined): ApiPlanEntry[] {
  if (!tag) return [];
  return MEAL_SLOTS.flatMap((slot) =>
    tag.entries.filter((e) => e.mealSlot === slot),
  );
}

/**
 * Monatsübersicht: nur die Beschriftungen, keine Einzelheiten.
 *
 * Aufbau wie im Kalender auf dem Telefon: oben ein Raster, das immer auf die
 * Breite passt, darunter die Liste des gewählten Tages. Auf schmalen Displays
 * stehen in den Zellen nur farbige Punkte – für Text ist dort kein Platz, und
 * ein waagerecht scrollendes Raster ist keine Kalenderübersicht mehr. Ab
 * mittlerer Breite stehen die Beschriftungen direkt in den Zellen.
 */
export function PlanCalendar({
  monat,
  tage,
  onTagWaehlen,
}: {
  monat: string;
  tage: ApiPlanDay[];
  onTagWaehlen: (datum: string) => void;
}) {
  const nachDatum = new Map(tage.map((t) => [t.date, t]));
  const anzahl = tageImMonat(monat);
  const leerVorne = spalte(monat);

  // Vorgewählt ist heute, sofern der Monat heute enthält – sonst der Monatsstart.
  const [gewaehlt, setGewaehlt] = useState(() =>
    heute().startsWith(monat.slice(0, 7)) ? heute() : monat,
  );

  // Beim Monatswechsel mitziehen, damit die Liste unten nie einen Tag zeigt,
  // der gar nicht im Raster steht.
  useEffect(() => {
    setGewaehlt(heute().startsWith(monat.slice(0, 7)) ? heute() : monat);
  }, [monat]);

  const gewaehlteEintraege = sortiert(nachDatum.get(gewaehlt));
  const gewaehlterTag = nachDatum.get(gewaehlt);

  return (
    <div className="space-y-4">
      <div>
        <div className="grid grid-cols-7 gap-1 pb-1 sm:gap-1.5">
          {WOCHENKOPF.map((w) => (
            <div
              key={w}
              className="text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sm:text-xs"
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {Array.from({ length: leerVorne }, (_, i) => (
            <div key={`leer-${i}`} aria-hidden="true" />
          ))}

          {Array.from({ length: anzahl }, (_, i) => {
            const tagesZahl = i + 1;
            const datum = `${monat.slice(0, 8)}${String(tagesZahl).padStart(2, "0")}`;
            const tag = nachDatum.get(datum);
            const eintraege = sortiert(tag);
            const istHeute = datum === heute();
            const istGewaehlt = datum === gewaehlt;

            return (
              <button
                key={datum}
                type="button"
                aria-pressed={istGewaehlt}
                aria-label={`${wochentag(datum)}, ${zeigeDatum(datum)}${
                  tag?.holiday ? ` – ${tag.holiday}` : ""
                }${
                  eintraege.length
                    ? ` – ${eintraege.map((e) => `${MEAL_SLOT_LABELS[e.mealSlot]} ${zustand(e)}`).join(", ")}`
                    : " – nichts geplant"
                }`}
                onClick={() => setGewaehlt(datum)}
                onDoubleClick={() => onTagWaehlen(datum)}
                className={cn(
                  "flex min-h-14 flex-col rounded-lg border p-1 text-left transition-colors sm:min-h-24 sm:p-1.5",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  istGewaehlt
                    ? "border-primary bg-primary/10"
                    : istHeute
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/40 hover:bg-accent",
                  istVergangen(datum) && !istHeute && !istGewaehlt && "opacity-60",
                )}
              >
                <div className="flex items-center justify-between gap-0.5">
                  <span
                    title={tag?.holiday ?? undefined}
                    className={cn(
                      "text-xs tabular-nums sm:text-sm",
                      istHeute
                        ? "flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground sm:size-6 sm:text-xs"
                        : tag?.holiday
                          ? // Feiertage stechen heraus – an ihnen gelten andere
                            // Regeln fürs Einkaufen und fürs Mittagessen.
                            "font-semibold text-(--terracotta)"
                          : "text-muted-foreground",
                    )}
                  >
                    {tagesZahl}
                  </span>
                  {tag?.isShoppingDay ? (
                    <ShoppingCart
                      className="size-3 shrink-0 text-(--terracotta) sm:size-3.5"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>

                {/* Schmal: Punkte. Ab sm: die Beschriftungen im Klartext. */}
                <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden" aria-hidden="true">
                  {eintraege.slice(0, 6).map((e) => (
                    <span
                      key={e.id}
                      className={cn(
                        "size-1.5 rounded-full",
                        e.isAbsent
                          ? "bg-muted-foreground/30"
                          : e.status === "suggested"
                            ? "border border-muted-foreground/70 bg-transparent"
                            : SLOT_PUNKT[e.mealSlot],
                      )}
                    />
                  ))}
                </div>

                <div className="mt-1 hidden space-y-1 sm:block" aria-hidden="true">
                  {tag?.holiday ? (
                    <span className="block truncate text-[10px] leading-tight font-medium text-(--terracotta)">
                      {tag.holiday}
                    </span>
                  ) : null}
                  {eintraege.map((e) => (
                    <SlotLabel key={e.id} eintrag={e} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <Legende />
      </div>

      <TagesListe
        datum={gewaehlt}
        tag={gewaehlterTag}
        eintraege={gewaehlteEintraege}
        onOeffnen={() => onTagWaehlen(gewaehlt)}
      />
    </div>
  );
}

/** Eine Beschriftung in der Zelle: Mahlzeit plus Zustand. */
function SlotLabel({ eintrag }: { eintrag: ApiPlanEntry }) {
  const slot = eintrag.mealSlot;

  if (eintrag.isAbsent) {
    return (
      <span className="block rounded px-1 py-0.5 text-[10px] leading-tight text-muted-foreground line-through">
        {SLOT_KURZ[slot]} nicht da
      </span>
    );
  }

  return (
    <span
      className={cn(
        "block rounded px-1 py-0.5 text-[10px] leading-tight font-medium",
        eintrag.status === "suggested"
          ? "border border-dashed border-muted-foreground/60 bg-transparent text-muted-foreground"
          : SLOT_FARBE[slot],
        eintrag.eatenAt && "opacity-60",
      )}
    >
      {SLOT_KURZ[slot]} {zustand(eintrag)}
    </span>
  );
}

/**
 * Der gewählte Tag als Liste – auf dem Telefon der eigentliche Ort, an dem
 * die Beschriftungen lesbar sind.
 */
function TagesListe({
  datum,
  tag,
  eintraege,
  onOeffnen,
}: {
  datum: string;
  tag: ApiPlanDay | undefined;
  eintraege: ApiPlanEntry[];
  onOeffnen: () => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="font-heading text-base font-semibold">
            {wochentag(datum)}
          </h3>
          <span className="text-sm text-muted-foreground">{zeigeDatum(datum)}</span>
          {datum === heute() ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
              heute
            </span>
          ) : null}
          {tag?.holiday ? (
            <span className="rounded-full bg-(--terracotta-light) px-2 py-0.5 text-xs font-semibold text-(--slot-snack-foreground)">
              {tag.holiday}
            </span>
          ) : null}
          {tag?.isShoppingDay ? (
            <span className="flex items-center gap-1 text-xs text-(--terracotta)">
              <ShoppingCart className="size-3.5" aria-hidden="true" />
              Einkaufstag
            </span>
          ) : null}
        </div>
        <Button size="sm" variant="outline" onClick={onOeffnen}>
          Tag bearbeiten
          <ArrowRight className="size-4" />
        </Button>
      </header>

      {eintraege.length === 0 ? (
        <p className="text-sm text-muted-foreground">Für diesen Tag ist nichts geplant.</p>
      ) : (
        <ul className="space-y-1.5">
          {eintraege.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span
                className={cn(
                  "inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                  e.isAbsent
                    ? "bg-muted text-muted-foreground line-through"
                    : e.status === "suggested"
                      ? "border border-dashed border-muted-foreground/60 text-muted-foreground"
                      : SLOT_FARBE[e.mealSlot],
                )}
              >
                {MEAL_SLOT_LABELS[e.mealSlot]} {zustand(e)}
              </span>
              {e.recipeTitle || e.freeText ? (
                <span className="text-muted-foreground">
                  {e.recipeTitle ?? e.freeText}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Kurze Erklärung der Zustände – sonst raten Leserinnen bei den Punkten. */
function Legende() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-(--slot-lunch)" aria-hidden="true" />
        geplant – Farbe nach Mahlzeit
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="size-2.5 rounded-full border border-dashed border-muted-foreground/70"
          aria-hidden="true"
        />
        vorgeschlagen
      </span>
      <span className="line-through">nicht da</span>
      <span className="flex items-center gap-1.5">
        <span className="font-semibold text-(--terracotta)">14</span>
        Feiertag
      </span>
      <span className="flex items-center gap-1.5">
        <ShoppingCart className="size-3 text-(--terracotta)" aria-hidden="true" />
        Einkaufstag
      </span>
    </div>
  );
}
