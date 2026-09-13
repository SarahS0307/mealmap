"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  api,
  type ApiPlanEntry,
  type ApiRecipeSummary,
  type ApiStockItem,
  type MealSlotWert,
  type PlanEntryInput,
} from "@/lib/api";
import { MEAL_SLOT_LABELS } from "@/lib/domain";
import { zeigeDatum } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Legt einen Eintrag an oder ändert ihn.
 *
 * Kochtermin und Essenstermin stehen getrennt: Der Essenstermin ist der Tag,
 * an dem das Formular geöffnet wurde; der Kochtermin lässt sich davor legen.
 * Damit lässt sich Vorkochen abbilden – ob und wann jemand vorkocht, gibt die
 * App aber nicht vor, das steht in den Gewohnheiten (users.habits).
 */
export function PlanEntryForm({
  datum,
  slot,
  eintrag,
  onFertig,
  onAbbruch,
}: {
  datum: string;
  slot: MealSlotWert;
  eintrag?: ApiPlanEntry;
  onFertig: (meldung?: string) => void;
  onAbbruch: () => void;
}) {
  const [rezepte, setRezepte] = useState<ApiRecipeSummary[]>([]);
  const [rezeptId, setRezeptId] = useState(eintrag?.recipeId ?? "");
  const [freitext, setFreitext] = useState(eintrag?.freeText ?? "");
  const [portionen, setPortionen] = useState(String(eintrag?.portionCount ?? 1));
  const [kochtag, setKochtag] = useState(eintrag?.cookDate ?? "");
  const [fuerWen, setFuerWen] = useState((eintrag?.forWhom ?? ["Ich"]).join(", "));
  const [gaeste, setGaeste] = useState(String(eintrag?.guestCount ?? 0));
  // Der Essenstermin lässt sich beim Ändern verschieben. Die Einkaufsliste
  // bleibt davon unberührt – gekauft ist gekauft, egal an welchem Tag gegessen
  // wird.
  const [essenstag, setEssenstag] = useState(eintrag?.eatDate ?? datum);
  // Woraus die Mahlzeit besteht, wenn sie aus dem Vorrat kommt.
  const [vorrat, setVorrat] = useState<ApiStockItem[]>([]);
  const [ausVorrat, setAusVorrat] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      (eintrag?.fromStock ?? []).map((p) => [p.stockItemId, p.portions]),
    ),
  );
  const [abwesend, setAbwesend] = useState(eintrag?.isAbsent ?? false);
  const [laeuft, setLaeuft] = useState(false);

  // Wie viele überhaupt mitessen: die Genannten plus die namenlosen.
  const esser =
    fuerWen.split(",").filter((n) => n.trim() !== "").length +
    (Number(gaeste) || 0);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    api
      .recipes()
      .then(({ recipes }) => setRezepte(recipes))
      .catch(() => setRezepte([]));
    api
      .stock()
      .then(({ items }) => setVorrat(items))
      .catch(() => setVorrat([]));
  }, []);

  /** Portionen eines Vorratspostens für diese Mahlzeit setzen. */
  function setzeVorrat(id: string, portionen: number) {
    setAusVorrat((v) => {
      const neu = { ...v };
      if (portionen <= 0) delete neu[id];
      else neu[id] = portionen;
      return neu;
    });
  }

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setFehler(null);

    const eingabe: PlanEntryInput = {
      eatDate: essenstag,
      cookDate: kochtag || null,
      mealSlot: slot,
      recipeId: rezeptId || null,
      freeText: freitext.trim() || null,
      portionCount: Number(portionen) || 1,
      forWhom: fuerWen
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean),
      guestCount: Number(gaeste) || 0,
      fromStock: Object.entries(ausVorrat)
        .filter(([, portionen]) => portionen > 0)
        .map(([stockItemId, portions]) => ({ stockItemId, portions })),
      isAbsent: abwesend,
    };

    try {
      if (eintrag) {
        await api.updatePlanEntry(eintrag.id, eingabe);
      } else {
        await api.createPlanEntry(eingabe);
      }
      onFertig();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
      setLaeuft(false);
    }
  }

  return (
    <form
      onSubmit={speichern}
      className="space-y-4 rounded-xl border border-primary/40 bg-card p-4"
    >
      <p className="font-medium">
        {MEAL_SLOT_LABELS[slot]} am {zeigeDatum(datum)}
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={abwesend}
          onChange={(e) => setAbwesend(e.target.checked)}
          className="size-4 accent-(--moss)"
        />
        Ich bin nicht da beziehungsweise esse nicht hier
      </label>

      {!abwesend ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="plan-rezept">Rezept</Label>
            <select
              id="plan-rezept"
              value={rezeptId}
              onChange={(e) => setRezeptId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">– kein Rezept –</option>
              {rezepte.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan-freitext">
              {rezeptId ? "Notiz" : "Oder frei eintragen"}
            </Label>
            <Input
              id="plan-freitext"
              value={freitext}
              onChange={(e) => setFreitext(e.target.value)}
              placeholder={rezeptId ? "optional" : "z. B. Kuchen backen"}
            />
          </div>

          {vorrat.length > 0 ? (
            <div className="space-y-2">
              <Label>Aus dem Vorrat</Label>
              <ul className="space-y-1.5 rounded-lg border border-border p-2">
                {vorrat.map((p) => {
                  const gewaehlt = ausVorrat[p.id] ?? 0;
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 text-sm">
                        {p.name}
                        <span className="text-muted-foreground">
                          {" "}
                          · {p.quantity} {p.unit} da
                          {p.location ? ` (${p.location})` : ""}
                        </span>
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={gewaehlt <= 0}
                          aria-label={`Weniger ${p.name}`}
                          onClick={() => setzeVorrat(p.id, gewaehlt - 0.5)}
                        >
                          <Minus className="size-4" />
                        </Button>
                        <span className="w-8 text-center text-sm tabular-nums">
                          {gewaehlt}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-label={`Mehr ${p.name}`}
                          onClick={() => setzeVorrat(p.id, gewaehlt + 0.5)}
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="text-sm text-muted-foreground">
                Eine Mahlzeit darf auch ganz aus dem Vorrat bestehen, ohne
                Rezept – etwa eine Portion Reis, eine Hackfleisch, eine Soße.
                Abgebucht wird erst, wenn du sie als gegessen abhakst.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="plan-portionen">Portionen</Label>
              <Input
                id="plan-portionen"
                type="number"
                min={0.5}
                max={99}
                step={0.5}
                value={portionen}
                onChange={(e) => setPortionen(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-kochtag">Gekocht wird am</Label>
              <Input
                id="plan-kochtag"
                type="date"
                max={essenstag}
                value={kochtag}
                onChange={(e) => setKochtag(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-fuerwen">Für wen</Label>
              <Input
                id="plan-fuerwen"
                value={fuerWen}
                onChange={(e) => setFuerWen(e.target.value)}
                placeholder="Ich"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="plan-gaeste">Weitere Personen</Label>
              <Input
                id="plan-gaeste"
                type="number"
                min={0}
                max={99}
                value={gaeste}
                onChange={(e) => setGaeste(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <p className="text-sm text-muted-foreground sm:pt-8">
                {esser === 1
                  ? "Isst eine Person."
                  : `Essen ${esser} Personen.`}{" "}
                Namentlich Genannte stehen links, Besuch ohne Namen hier.
              </p>
            </div>
          </div>

          {eintrag ? (
            <div className="space-y-2">
              <Label htmlFor="plan-essenstag">Gegessen wird am</Label>
              <Input
                id="plan-essenstag"
                type="date"
                value={essenstag}
                onChange={(e) => {
                  setEssenstag(e.target.value);
                  // Kochtermin mitziehen, wenn er sonst danach läge.
                  if (kochtag !== "" && kochtag > e.target.value) {
                    setKochtag(e.target.value);
                  }
                }}
              />
              <p className="text-sm text-muted-foreground">
                Verschiebt den Eintrag auf einen anderen Tag. Was du dafür
                schon eingekauft hast, bleibt davon unberührt.
              </p>
            </div>
          ) : null}

          <p className="text-sm text-muted-foreground">
            Der Kochtermin darf vor dem Essenstermin liegen, zum Beispiel
            sonntags kochen und unter der Woche essen. Leer lassen, wenn nicht
            selbst gekocht wird.
          </p>
        </>
      ) : null}

      {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={laeuft}>
          {laeuft ? "Speichert …" : eintrag ? "Änderungen speichern" : "Einplanen"}
        </Button>
        <Button type="button" variant="ghost" onClick={onAbbruch}>
          Abbrechen
        </Button>
        {eintrag ? (
          <Button
            type="button"
            variant="ghost"
            className={cn("ml-auto text-destructive")}
            onClick={async () => {
              const { toStock } = await api.deletePlanEntry(eintrag.id);
              onFertig(
                toStock.length > 0
                  ? `Gestrichen. Schon Gekauftes ist in den Vorrat gewandert: ${toStock
                      .map((p) => `${p.quantity} ${p.unit ?? ""} ${p.name}`.trim())
                      .join(", ")}.`
                  : undefined,
              );
            }}
          >
            Entfernen
          </Button>
        ) : null}
      </div>
    </form>
  );
}
