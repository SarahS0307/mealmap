"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
  Snowflake,
  Sparkles,
  Trash2,
  Plus,
  ShoppingCart,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MealChip } from "@/components/meal-chip";
import { PlanCalendar } from "@/components/plan-calendar";
import { PlanEntryForm } from "@/components/plan-entry-form";
import { useSession } from "@/components/session-provider";
import {
  api,
  ApiError,
  type ApiCookDate,
  type ApiPlanDay,
  type ApiPlanEntry,
  type MealSlotWert,
} from "@/lib/api";
import { MEAL_SLOTS, MEAL_SLOT_LABELS } from "@/lib/domain";
import {
  heute,
  istSonntag,
  istVergangen,
  monatsAnfang,
  montag,
  plusMonate,
  plusTage,
  relativeMarke,
  relativerTag,
  tageImMonat,
  wochentag,
  zeigeDatum,
  zeigeMonat,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Chip-Farbe je Slot – Snacks teilen sich eine. */
const SLOT_VARIANTEN: Record<
  MealSlotWert,
  React.ComponentProps<typeof MealChip>["variant"]
> = {
  breakfast: "breakfast",
  snack_am: "snack",
  lunch: "lunch",
  snack_pm: "snack",
  dinner: "dinner",
  other: "other",
};

const TAGE_JE_SEITE = 7;

/**
 * Zwei Blickwinkel auf denselben Plan: der Monat zeigt nur, was wann ansteht,
 * die Tage zeigen die Einzelheiten und lassen sich bearbeiten.
 */
type Ansicht = "kalender" | "tage";

export default function PlanPage() {
  const { user } = useSession();
  // Mit Gewohnheiten und Schlüssel geht der Vorschlag über die KI – und
  // kostet damit Geld. Das gehört an den Knopf, nicht in die Rechnung.
  const nutztKi = Boolean(user?.habits && user?.hasApiKey);

  const [ansicht, setAnsicht] = useState<Ansicht>("kalender");
  const [monat, setMonat] = useState(monatsAnfang(heute()));
  // Wochen beginnen immer montags, egal welchen Tag man anklickt.
  const [von, setVon] = useState(montag(heute()));
  const [tage, setTage] = useState<ApiPlanDay[]>([]);
  const [kochtermine, setKochtermine] = useState<ApiCookDate[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [rechnet, setRechnet] = useState(false);
  const [feiertagsfrage, setFeiertagsfrage] = useState<{
    tag: ApiPlanDay;
    text: string;
  } | null>(null);
  const [einfrieren, setEinfrieren] = useState<ApiPlanEntry | null>(null);

  // Der heutige Tag soll beim Öffnen oben stehen. Die Woche fängt montags an,
  // heute liegt also oft mittendrin – gescrollt wird deshalb, statt die Liste
  // umzusortieren: die vergangenen Tage der Woche bleiben erreichbar.
  const heuteRef = useRef<HTMLElement | null>(null);
  const gescrollt = useRef<string | null>(null);
  const [formular, setFormular] = useState<{
    datum: string;
    slot: MealSlotWert;
    eintrag?: ApiPlanEntry;
  } | null>(null);

  const imKalender = ansicht === "kalender";

  const laden = useCallback(async () => {
    try {
      const { days, cookDates } = imKalender
        ? await api.plan(monat, tageImMonat(monat))
        : await api.plan(von, TAGE_JE_SEITE);
      setTage(days);
      setKochtermine(cookDates);
      setFehler(null);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Laden fehlgeschlagen.");
    } finally {
      setLaedt(false);
    }
  }, [imKalender, monat, von]);

  useEffect(() => {
    void laden();
  }, [laden]);

  // Nur einmal je Woche scrollen, nicht nach jedem Neuladen – sonst springt
  // die Seite weg, sobald man etwas abhakt.
  useEffect(() => {
    if (imKalender || laedt || !heuteRef.current) return;
    if (gescrollt.current === von) return;
    gescrollt.current = von;
    heuteRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [imKalender, laedt, von, tage]);

  async function markieren(e: ApiPlanEntry, was: "cooked" | "eaten") {
    const gesetzt = was === "cooked" ? Boolean(e.cookedAt) : Boolean(e.eatenAt);
    try {
      await api.markPlanEntry(e.id, was, !gesetzt);
      await laden();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  /** Füllt die angezeigte Woche mit Vorschlägen. */
  async function vorschlagen() {
    setRechnet(true);
    setHinweis(null);
    try {
      const { created, reason } = await api.suggestPlan(von, TAGE_JE_SEITE);
      if (created > 0) {
        setHinweis(
          `${created} ${created === 1 ? "Vorschlag" : "Vorschläge"} eingetragen. Übernimm, was passt – der Rest lässt sich verwerfen.`,
        );
      } else if (reason === "keine_rezepte") {
        setHinweis("In deiner Sammlung liegt noch kein Rezept, aus dem sich etwas vorschlagen ließe.");
      } else {
        setHinweis("Diese Woche ist schon durchgeplant – es war kein Slot mehr frei.");
      }
      setFehler(null);
      await laden();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Vorschlagen fehlgeschlagen.");
    } finally {
      setRechnet(false);
    }
  }

  /** Wirft alle unbestätigten Vorschläge der Woche weg. */
  async function verwerfen() {
    try {
      const { deleted } = await api.clearPlanSuggestions(von, TAGE_JE_SEITE);
      setHinweis(
        deleted > 0
          ? `${deleted} ${deleted === 1 ? "Vorschlag" : "Vorschläge"} verworfen.`
          : "Es gab keine offenen Vorschläge in dieser Woche.",
      );
      setFehler(null);
      await laden();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Verwerfen fehlgeschlagen.");
    }
  }

  async function uebernehmen(e: ApiPlanEntry) {
    try {
      await api.confirmPlanEntry(e.id);
      await laden();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Übernehmen fehlgeschlagen.");
    }
  }

  /**
   * Setzt oder entfernt den Einkaufstag.
   *
   * An einem Feiertag fragt der Server zurück, statt es einfach zu tun –
   * "teilweise eingeschränkt" heißt eben nicht "geht nicht". Sagt Sarah ja,
   * geht derselbe Aufruf noch einmal mit ausdrücklicher Zustimmung raus.
   */
  async function einkaufstag(tag: ApiPlanDay, trotzFeiertag = false) {
    try {
      await api.setPlanDay(tag.date, !tag.isShoppingDay, { trotzFeiertag });
      setFeiertagsfrage(null);
      await laden();
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 409 &&
        (err.data as { needsDecision?: string } | undefined)?.needsDecision ===
          "feiertag"
      ) {
        setFeiertagsfrage({
          tag,
          text:
            (err.data as { message?: string }).message ??
            "An diesem Feiertag haben die Läden zu oder nur eingeschränkt offen.",
        });
        return;
      }
      setFehler(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl">Plan</h1>
          <p className="text-muted-foreground">
            {imKalender
              ? "Der Monat auf einen Blick. Tippe einen Tag an, um ihn zu bearbeiten."
              : "Tag für Tag. Der Kochtermin darf vom Essenstermin abweichen."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Ansicht"
            className="flex rounded-lg border border-border p-0.5"
          >
            <Button
              size="sm"
              variant={imKalender ? "default" : "ghost"}
              aria-pressed={imKalender}
              onClick={() => setAnsicht("kalender")}
            >
              <CalendarDays className="size-4" />
              Kalender
            </Button>
            <Button
              size="sm"
              variant={imKalender ? "ghost" : "default"}
              aria-pressed={!imKalender}
              onClick={() => setAnsicht("tage")}
            >
              <List className="size-4" />
              Tage
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                imKalender
                  ? setMonat(plusMonate(monat, -1))
                  : setVon(plusTage(von, -TAGE_JE_SEITE))
              }
              aria-label={imKalender ? "Ein Monat zurück" : "Eine Woche zurück"}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setVon(montag(heute()));
                setMonat(monatsAnfang(heute()));
              }}
            >
              Heute
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                imKalender
                  ? setMonat(plusMonate(monat, 1))
                  : setVon(plusTage(von, TAGE_JE_SEITE))
              }
              aria-label={imKalender ? "Ein Monat vor" : "Eine Woche vor"}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {imKalender ? (
        <h2 className="font-heading text-xl font-semibold">{zeigeMonat(monat)}</h2>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void vorschlagen()} disabled={rechnet}>
            <Sparkles className="size-4" />
            {rechnet
              ? "einen Moment …"
              : nutztKi
                ? "Woche vorschlagen (KI)"
                : "Woche vorschlagen"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void verwerfen()}>
            <Trash2 className="size-4" />
            Vorschläge verwerfen
          </Button>
          <span className="text-sm text-muted-foreground">
            {nutztKi
              ? "Plant nach deinen Gewohnheiten – nutzt die KI und kostet etwas über deinen Schlüssel. Geplantes bleibt stehen."
              : "Füllt freie Mittag- und Abendslots. Geplantes bleibt stehen."}
          </span>
        </div>
      )}

      {hinweis ? (
        <p className="rounded-lg border border-border bg-accent px-3 py-2 text-sm">
          {hinweis}
        </p>
      ) : null}

      {einfrieren ? (
        <FreezeForm
          eintrag={einfrieren}
          onFertig={(meldung) => {
            setEinfrieren(null);
            setHinweis(meldung);
            void laden();
          }}
          onAbbruch={() => setEinfrieren(null)}
        />
      ) : null}

      {feiertagsfrage ? (
        <div className="rounded-lg border border-(--terracotta) bg-card p-3">
          <p className="text-sm">
            <strong>{feiertagsfrage.text}</strong> Trotzdem als Einkaufstag
            eintragen?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => void einkaufstag(feiertagsfrage.tag, true)}
            >
              Trotzdem eintragen
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setFeiertagsfrage(null)}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      ) : null}

      {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}

      {laedt ? (
        <p className="text-muted-foreground">Einen Moment …</p>
      ) : imKalender ? (
        <PlanCalendar
          monat={monat}
          tage={tage}
          onTagWaehlen={(datum) => {
            setVon(montag(datum));
            setAnsicht("tage");
          }}
        />
      ) : (
        <div className="space-y-4">
          {tage.map((tag) => {
            const kochenHeute = kochtermine.filter((k) => k.cookDate === tag.date);

            return (
              <section
                key={tag.date}
                ref={tag.date === heute() ? heuteRef : undefined}
                className={cn(
                  // Etwas Abstand nach oben, damit der Tag beim Scrollen nicht
                  // direkt am Fensterrand klebt.
                  "scroll-mt-4 rounded-xl border bg-card",
                  tag.date === heute()
                    ? "border-primary"
                    : istVergangen(tag.date)
                      ? // Vergangenes bleibt voll bedienbar, tritt aber zurück.
                        "border-border opacity-60"
                      : "border-border",
                )}
              >
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h2 className="font-heading text-lg font-semibold">
                      {wochentag(tag.date)}
                    </h2>
                    <span className="text-sm text-muted-foreground">
                      {zeigeDatum(tag.date)}
                    </span>
                    {relativeMarke(tag.date) ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                        {relativeMarke(tag.date)}
                      </span>
                    ) : null}
                    {tag.holiday ? (
                      <span className="rounded-full bg-(--terracotta-light) px-2 py-0.5 text-xs font-semibold text-(--slot-snack-foreground)">
                        {tag.holiday}
                      </span>
                    ) : null}
                  </div>
                  {/* Sonntags haben die Läden zu – dann steht hier gar nichts,
                      statt eines Knopfes, der ohnehin nicht geht. */}
                  {!istSonntag(tag.date) || tag.isShoppingDay ? (
                    <Button
                      size="sm"
                      variant={tag.isShoppingDay ? "default" : "ghost"}
                      title={tag.holiday ? `${tag.holiday} – eingeschränkt` : undefined}
                      onClick={() => void einkaufstag(tag)}
                    >
                      <ShoppingCart className="size-4" />
                      {tag.isShoppingDay ? "Einkaufstag" : "Als Einkaufstag"}
                    </Button>
                  ) : null}
                </header>

                {kochenHeute.length > 0 ? (
                  <div className="border-b border-border bg-(--slot-lunch)/20 px-3 py-2">
                    <p className="text-sm">
                      <ChefHat className="mr-1.5 inline size-4" aria-hidden="true" />
                      Heute kochen für später:{" "}
                      {kochenHeute
                        .map(
                          (k) =>
                            `${k.recipeTitle ?? "?"} (${k.portionCount} Portionen, für ${relativerTag(k.eatDate)})`,
                        )
                        .join(" · ")}
                    </p>
                  </div>
                ) : null}

                <div className="divide-y divide-border">
                  {MEAL_SLOTS.map((slot) => {
                    const eintraege = tag.entries.filter((e) => e.mealSlot === slot);
                    const offen =
                      formular?.datum === tag.date && formular.slot === slot;

                    return (
                      <div key={slot} className="space-y-2 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <MealChip variant={SLOT_VARIANTEN[slot]}>
                            {MEAL_SLOT_LABELS[slot]}
                          </MealChip>
                          {!offen ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`${MEAL_SLOT_LABELS[slot]} einplanen`}
                              onClick={() =>
                                setFormular({ datum: tag.date, slot })
                              }
                            >
                              <Plus className="size-4" />
                            </Button>
                          ) : null}
                        </div>

                        {eintraege.map((e) => (
                          <PlanEintrag
                            key={e.id}
                            eintrag={e}
                            onBearbeiten={() =>
                              setFormular({ datum: tag.date, slot, eintrag: e })
                            }
                            onMarkieren={(was) => void markieren(e, was)}
                            onUebernehmen={() => void uebernehmen(e)}
                            onEinfrieren={() => setEinfrieren(e)}
                          />
                        ))}

                        {eintraege.length === 0 && !offen ? (
                          <p className="text-sm text-muted-foreground">—</p>
                        ) : null}

                        {offen ? (
                          <PlanEntryForm
                            datum={tag.date}
                            slot={slot}
                            eintrag={formular.eintrag}
                            onFertig={() => {
                              setFormular(null);
                              void laden();
                            }}
                            onAbbruch={() => setFormular(null)}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="border-t border-border pt-4 text-sm text-muted-foreground">
        Gekocht und gegessen hakst du selbst ab – die App leitet nichts daraus
        ab, dass ein Tag vorbei ist. Rezepte findest du in deiner{" "}
        <Link href="/rezepte/" className="text-primary underline">
          Sammlung
        </Link>
        .
      </p>
    </div>
  );
}

function PlanEintrag({
  eintrag,
  onBearbeiten,
  onMarkieren,
  onUebernehmen,
  onEinfrieren,
}: {
  eintrag: ApiPlanEntry;
  onBearbeiten: () => void;
  onMarkieren: (was: "cooked" | "eaten") => void;
  onUebernehmen: () => void;
  onEinfrieren: () => void;
}) {
  if (eintrag.isAbsent) {
    return (
      <button
        type="button"
        onClick={onBearbeiten}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
      >
        <UserX className="size-4" aria-hidden="true" />
        Nicht da
      </button>
    );
  }

  const gekocht = Boolean(eintrag.cookedAt);
  const gegessen = Boolean(eintrag.eatenAt);

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        eintrag.status === "suggested"
          ? "border-dashed border-muted-foreground/50"
          : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button type="button" onClick={onBearbeiten} className="flex-1 text-left">
          <p className={cn("font-medium", gegessen && "text-muted-foreground line-through")}>
            {eintrag.recipeTitle ??
              eintrag.freeText ??
              // Eine Mahlzeit ganz aus dem Vorrat hat keinen eigenen Titel –
              // dann benennen die Posten sie. Bleibt auch das leer, wurde der
              // Vorratsposten inzwischen gelöscht.
              (eintrag.fromStock.length > 0
                ? eintrag.fromStock.map((p) => p.name).join(" + ")
                : "Ohne Inhalt – der Vorratsposten wurde gelöscht")}
          </p>
          <p className="text-sm text-muted-foreground">
            {eintrag.portionCount}{" "}
            {eintrag.portionCount === 1 ? "Portion" : "Portionen"}
            {eintrag.forWhom.join(", ") !== "Ich" || eintrag.guestCount > 0
              ? ` · für ${[
                  ...eintrag.forWhom,
                  ...(eintrag.guestCount > 0
                    ? [
                        eintrag.guestCount === 1
                          ? "eine weitere Person"
                          : `${eintrag.guestCount} weitere Personen`,
                      ]
                    : []),
                ].join(", ")}`
              : ""}
            {eintrag.cookDate && eintrag.cookDate !== eintrag.eatDate
              ? ` · gekocht am ${relativerTag(eintrag.cookDate)}`
              : ""}
            {eintrag.recipeTitle && eintrag.freeText ? ` · ${eintrag.freeText}` : ""}
          </p>
          {eintrag.fromStock.length > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              <Snowflake className="mr-1 inline size-3.5" aria-hidden="true" />
              {eintrag.fromStock
                .map((p) => `${p.portions} ${p.unit ?? "Portion"} ${p.name}`)
                .join(" · ")}
              {eintrag.fromStock.some((p) => p.consumedAt)
                ? " (abgebucht)"
                : ""}
            </p>
          ) : null}
          {eintrag.status === "suggested" ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Vorschlag – noch nicht bestätigt
            </p>
          ) : null}
        </button>

        <div className="flex flex-wrap gap-1">
          {eintrag.recipeId && !gegessen ? (
            <Button
              size="sm"
              variant="outline"
              render={
                <Link
                  href={`/rezepte/kochen/?id=${eintrag.recipeId}&portionen=${eintrag.portionCount}`}
                />
              }
            >
              <ChefHat className="size-4" />
              kochen
            </Button>
          ) : null}
          {eintrag.status === "suggested" ? (
            <Button size="sm" onClick={onUebernehmen}>
              <Check className="size-4" />
              übernehmen
            </Button>
          ) : null}
          {gekocht ? (
            <Button size="sm" variant="outline" onClick={onEinfrieren}>
              <Snowflake className="size-4" />
              einfrieren
            </Button>
          ) : null}
          {eintrag.cookDate ? (
            <Button
              size="sm"
              variant={gekocht ? "default" : "outline"}
              onClick={() => onMarkieren("cooked")}
              aria-pressed={gekocht}
              title={gekocht ? "Als nicht gekocht markieren" : "Als gekocht markieren"}
            >
              <Check className="size-4" />
              {gekocht ? "gekocht" : "als gekocht"}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={gegessen ? "default" : "outline"}
            onClick={() => onMarkieren("eaten")}
            aria-pressed={gegessen}
            title={gegessen ? "Als nicht gegessen markieren" : "Als gegessen markieren"}
          >
            <Check className="size-4" />
            {gegessen ? "gegessen" : "essen"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Einfrieren, was von einem gekochten Eintrag übrig ist.
 *
 * Die Portionszahl gibt Sarah selbst an – so beschreibt sie es auch: „vier
 * Portionen Reis eingefroren“. Vorbelegt ist die Portionszahl des Eintrags,
 * geändert werden darf sie immer, weil selten alles übrig bleibt.
 */
function FreezeForm({
  eintrag,
  onFertig,
  onAbbruch,
}: {
  eintrag: ApiPlanEntry;
  onFertig: (meldung: string) => void;
  onAbbruch: () => void;
}) {
  const vorschlag = eintrag.recipeTitle ?? eintrag.freeText ?? "Vorgekochtes";
  const [name, setName] = useState(vorschlag);
  const [portionen, setPortionen] = useState(String(eintrag.portionCount));
  const [haltbar, setHaltbar] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    try {
      const { item } = await api.freezePlanEntry(eintrag.id, {
        portions: Number(portionen) || 1,
        name: name.trim() || vorschlag,
        location: "Gefrierschrank",
        bestBefore: haltbar || undefined,
      });
      onFertig(
        `${item.quantity} ${item.unit}${item.quantity === 1 ? "" : "en"} ${item.name} liegen jetzt im Gefrierschrank.`,
      );
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Einfrieren fehlgeschlagen.");
      setLaeuft(false);
    }
  }

  return (
    <form
      onSubmit={speichern}
      className="space-y-4 rounded-xl border border-primary bg-card p-4"
    >
      <div>
        <h2 className="font-heading text-lg font-semibold">Einfrieren</h2>
        <p className="text-sm text-muted-foreground">
          Wie viele Portionen sind übrig geblieben?
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="frost-portionen">Portionen</Label>
          <Input
            id="frost-portionen"
            type="number"
            min={0.5}
            step={0.5}
            value={portionen}
            onChange={(e) => setPortionen(e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="frost-name">Als was</Label>
          <Input
            id="frost-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="frost-haltbar">Haltbar bis (wenn bekannt)</Label>
          <Input
            id="frost-haltbar"
            type="date"
            min={heute()}
            value={haltbar}
            onChange={(e) => setHaltbar(e.target.value)}
          />
        </div>
      </div>

      {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={laeuft}>
          <Snowflake className="size-4" />
          {laeuft ? "Speichert …" : "In den Vorrat"}
        </Button>
        <Button type="button" variant="ghost" onClick={onAbbruch}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
