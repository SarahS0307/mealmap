"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Minus, Pencil, Plus, Snowflake, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type ApiStockItem, type StoreCategoryWert } from "@/lib/api";
import { STORE_CATEGORY_LABELS } from "@/lib/domain";
import { heute, istVergangen, zeigeDatum } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Der Vorrat: was vorgekocht, eingefroren oder sonst vorrätig ist.
 *
 * Zwei Arten von Posten, die sich in der Einheit unterscheiden:
 * <strong>fertiges Essen</strong> zählt in Portionen („vier Portionen Reis“),
 * <strong>Zutaten</strong> in Gramm, Stück oder Packungen. Beides steht
 * getrennt, weil es beim Einkaufen und Planen verschieden gebraucht wird.
 *
 * Sortiert wird nach Dringlichkeit: Was verdirbt, steht oben; der
 * Gefrierschrank am Ende, denn was dort liegt, eilt nicht.
 */
export default function VorratPage() {
  const [posten, setPosten] = useState<ApiStockItem[]>([]);
  const [orte, setOrte] = useState<string[]>([]);
  const [einheit, setEinheit] = useState("Portion");
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [formularOffen, setFormularOffen] = useState(false);
  const [bearbeitet, setBearbeitet] = useState<ApiStockItem | null>(null);

  const laden = useCallback(async () => {
    try {
      const { items, locations, unit } = await api.stock();
      setPosten(items);
      setOrte(locations);
      setEinheit(unit);
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

  /** Menge ändern – Schrittweite passt zur Art des Postens. */
  async function verschieben(p: ApiStockItem, delta: number) {
    const neu = Math.max(0, p.quantity + delta);
    try {
      if (neu <= 0) {
        await api.deleteStockItem(p.id);
      } else {
        await api.updateStockItem(p.id, {
          name: p.name,
          kind: p.kind,
          storeCategory: p.storeCategory,
          quantity: neu,
          unit: p.unit,
          location: p.location,
          recipeId: p.recipeId,
          bestBefore: p.bestBefore,
        });
      }
      await laden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  }

  async function loeschen(p: ApiStockItem) {
    try {
      await api.deleteStockItem(p.id);
      await laden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    }
  }

  // Nach Ort gruppieren, in der Reihenfolge der Serverliste – der
  // Gefrierschrank steht dort bewusst am Ende.
  const nachOrt = orte
    .map((ort) => ({
      ort,
      items: posten.filter((p) => (p.location ?? "Sonstiges") === ort),
    }))
    .filter((g) => g.items.length > 0);

  const ohneOrt = posten.filter(
    (p) => !orte.includes(p.location ?? "Sonstiges"),
  );
  if (ohneOrt.length > 0) nachOrt.push({ ort: "Ohne Ort", items: ohneOrt });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl">Vorrat</h1>
          <p className="text-muted-foreground">
            Fertiges Essen zählt in {einheit}en, Zutaten in Gramm oder Stück.
          </p>
        </div>
        {!formularOffen ? (
          <Button size="sm" onClick={() => setFormularOffen(true)}>
            <Plus className="size-4" />
            Posten anlegen
          </Button>
        ) : null}
      </div>

      {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}

      {formularOffen ? (
        <VorratForm
          orte={orte}
          einheit={einheit}
          onFertig={() => {
            setFormularOffen(false);
            void laden();
          }}
          onAbbruch={() => setFormularOffen(false)}
        />
      ) : null}

      {bearbeitet ? (
        <VorratForm
          orte={orte}
          einheit={einheit}
          posten={bearbeitet}
          onFertig={() => {
            setBearbeitet(null);
            void laden();
          }}
          onAbbruch={() => setBearbeitet(null)}
        />
      ) : null}

      {laedt ? (
        <p className="text-muted-foreground">Einen Moment …</p>
      ) : posten.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
          Noch nichts im Vorrat. Was du im Plan als gekocht abhakst, kannst du
          dort einfrieren – oder du legst hier von Hand einen Posten an.
        </p>
      ) : (
        <div className="space-y-8">
          {nachOrt.map((g) => (
            <section key={g.ort} className="space-y-4">
              <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
                {g.ort === "Gefrierschrank" ? (
                  <Snowflake className="size-4" aria-hidden="true" />
                ) : null}
                {g.ort}
              </h2>
              {gruppiereNachKategorie(g.items).map(([kategorie, liste]) => (
                <div key={kategorie} className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {STORE_CATEGORY_LABELS[kategorie]}
                  </h3>
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {liste.map((p) => (
                      <VorratKachel
                        key={p.id}
                        posten={p}
                        onBearbeiten={() => setBearbeitet(p)}
                        onWeniger={() => void verschieben(p, p.kind === "cooked" ? -0.5 : -50)}
                        onMehr={() => void verschieben(p, p.kind === "cooked" ? 0.5 : 50)}
                        onLoeschen={() => void loeschen(p)}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      <p className="border-t border-border pt-4 text-sm text-muted-foreground">
        Der Bestand sinkt von selbst, sobald du im Plan eine Mahlzeit als
        gegessen abhakst, die aus dem Vorrat kommt. Nimmst du den Haken zurück,
        kommt er wieder. Ein Klick auf eine Kachel öffnet die Bearbeitung.
      </p>
    </div>
  );
}

/**
 * Gruppiert nach Kategorie und stellt das Verderbliche nach vorn.
 *
 * Innerhalb einer Kategorie zuerst, was abgelaufen ist, dann was bald fällig
 * wird — man räumt den Vorrat von vorn nach hinten ab.
 */
function gruppiereNachKategorie(
  items: ApiStockItem[],
): [StoreCategoryWert, ApiStockItem[]][] {
  const rang = { abgelaufen: 0, bald: 1, ok: 2 } as const;

  const gruppen = new Map<StoreCategoryWert, ApiStockItem[]>();
  for (const p of items) {
    gruppen.set(p.storeCategory, [...(gruppen.get(p.storeCategory) ?? []), p]);
  }

  for (const liste of gruppen.values()) {
    liste.sort(
      (a, b) =>
        rang[a.freshness] - rang[b.freshness] || a.name.localeCompare(b.name),
    );
  }

  // Kategorien mit Verderblichem zuerst.
  return [...gruppen.entries()].sort(
    ([, a], [, b]) => rang[a[0].freshness] - rang[b[0].freshness],
  );
}

/** Ein Vorratsposten als Kachel. Ein Klick öffnet die Bearbeitung. */
function VorratKachel({
  posten,
  onBearbeiten,
  onWeniger,
  onMehr,
  onLoeschen,
}: {
  posten: ApiStockItem;
  onBearbeiten: () => void;
  onWeniger: () => void;
  onMehr: () => void;
  onLoeschen: () => void;
}) {
  const abgelaufen = posten.freshness === "abgelaufen";

  return (
    <li className="relative">
      <button
        type="button"
        onClick={onBearbeiten}
        aria-label={`${posten.name} bearbeiten`}
        className={cn(
          "flex h-full w-full flex-col items-center gap-1 rounded-xl border p-3 pt-4 text-center transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          abgelaufen
            ? "border-destructive bg-card"
            : "border-border bg-card hover:border-primary hover:bg-accent",
        )}
      >
        <span className="text-3xl leading-none" aria-hidden="true">
          {posten.icon}
        </span>
        <span className="mt-1 text-sm leading-tight font-medium break-words">
          {posten.name}
        </span>
        <span className="text-sm tabular-nums text-muted-foreground">
          {posten.quantity} {posten.unit}
        </span>

        <FrischeMarke posten={posten} />

        {/* Wofür der Posten schon verplant ist – "SO Nudelsalat". */}
        {posten.reservedFor.length > 0 ? (
          <span className="mt-1 flex flex-wrap justify-center gap-1">
            {posten.reservedFor.map((r, i) => (
              <span
                key={`${r.date}-${i}`}
                className="rounded bg-muted px-1.5 py-0.5 text-[11px] leading-tight text-muted-foreground"
                title={`${r.portions} ${r.unit ?? ""} am ${zeigeDatum(r.date)} für ${r.what}`}
              >
                {posten.kind === "cooked" ? "" : `${r.portions} ${r.unit ?? ""} `}
                <strong>{r.day}</strong> {r.what}
              </span>
            ))}
          </span>
        ) : null}

        <span className="mt-auto pt-1 text-xs leading-tight text-muted-foreground">
          {posten.kind === "cooked" ? "fertiges Essen" : "Zutat"}
          {posten.recipeTitle ? ` · aus ${posten.recipeTitle}` : ""}
        </span>
      </button>

      <div className="absolute top-0.5 right-0.5 flex">
        <Button
          size="sm"
          variant="ghost"
          aria-label={`${posten.name} entfernen`}
          onClick={onLoeschen}
          className="size-7 p-0 text-muted-foreground"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="mt-1 flex items-center justify-center gap-1">
        <Button
          size="sm"
          variant="outline"
          aria-label={`Weniger ${posten.name}`}
          onClick={onWeniger}
          className="size-8 p-0"
        >
          <Minus className="size-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label={`Mehr ${posten.name}`}
          onClick={onMehr}
          className="size-8 p-0"
        >
          <Plus className="size-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label={`${posten.name} bearbeiten`}
          onClick={onBearbeiten}
          className="size-8 p-0 text-muted-foreground"
        >
          <Pencil className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}

/**
 * Sagt, wie es um die Haltbarkeit steht.
 *
 * Nur bei abgelaufen oder bald fällig – sonst stünde an jedem Posten eine
 * Marke und keine fiele mehr auf.
 */
function FrischeMarke({ posten }: { posten: ApiStockItem }) {
  if (posten.freshness === "ok") return null;

  const abgelaufen = posten.freshness === "abgelaufen";
  const text = abgelaufen
    ? "abgelaufen"
    : posten.daysLeft !== null
      ? `noch ${posten.daysLeft} ${posten.daysLeft === 1 ? "Tag" : "Tage"}`
      : posten.perishing === "sofort"
        ? "sehr verderblich"
        : "verdirbt schnell";

  return (
    <span
      className={cn(
        "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs leading-tight font-semibold",
        abgelaufen
          ? "bg-destructive text-white"
          : "bg-(--slot-snack) text-(--slot-snack-foreground)",
      )}
    >
      <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
      {text}
    </span>
  );
}

/** Posten anlegen oder ändern. */
function VorratForm({
  orte,
  einheit,
  posten,
  onFertig,
  onAbbruch,
}: {
  orte: string[];
  einheit: string;
  posten?: ApiStockItem;
  onFertig: () => void;
  onAbbruch: () => void;
}) {
  const [art, setArt] = useState<"cooked" | "ingredient">(
    posten?.kind ?? "ingredient",
  );
  const [name, setName] = useState(posten?.name ?? "");
  const [menge, setMenge] = useState(posten?.quantity?.toString() ?? "1");
  const [eigeneEinheit, setEigeneEinheit] = useState(
    posten?.unit ?? (posten?.kind === "cooked" ? einheit : "g"),
  );
  const [bereich, setBereich] = useState<StoreCategoryWert>(
    posten?.storeCategory ?? "other",
  );
  const [ort, setOrt] = useState(posten?.location ?? orte[0] ?? "");
  const [haltbar, setHaltbar] = useState(posten?.bestBefore ?? "");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  /** Wechselt die Art und zieht die Einheit nach, solange sie unberührt ist. */
  function artWechseln(neu: "cooked" | "ingredient") {
    setArt(neu);
    if (eigeneEinheit === "" || eigeneEinheit === einheit || eigeneEinheit === "g") {
      setEigeneEinheit(neu === "cooked" ? einheit : "g");
    }
  }

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    try {
      const eingabe = {
        name: name.trim(),
        kind: art,
        storeCategory: bereich,
        quantity: Number(menge) || 0,
        unit: eigeneEinheit.trim() || (art === "cooked" ? einheit : "g"),
        location: ort || null,
        bestBefore: haltbar || null,
      };
      if (posten) {
        await api.updateStockItem(posten.id, eingabe);
      } else {
        await api.createStockItem(eingabe);
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
      className={cn(
        "space-y-4 rounded-xl border bg-card p-4",
        posten ? "border-primary" : "border-border",
      )}
    >
      <h2 className="font-heading text-lg font-semibold">
        {posten ? "Posten bearbeiten" : "Posten anlegen"}
      </h2>

      <div
        role="group"
        aria-label="Art des Postens"
        className="flex flex-wrap gap-2"
      >
        <Button
          type="button"
          size="sm"
          variant={art === "ingredient" ? "default" : "outline"}
          aria-pressed={art === "ingredient"}
          onClick={() => artWechseln("ingredient")}
        >
          Zutat
        </Button>
        <Button
          type="button"
          size="sm"
          variant={art === "cooked" ? "default" : "outline"}
          aria-pressed={art === "cooked"}
          onClick={() => artWechseln("cooked")}
        >
          Fertiges Essen
        </Button>
        <span className="self-center text-sm text-muted-foreground">
          {art === "cooked"
            ? "wird in Portionen gezählt"
            : "wird in Gramm, Stück oder Packungen gezählt"}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="vorrat-name">Was ist es?</Label>
          <Input
            id="vorrat-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={art === "cooked" ? "Nudelauflauf" : "Basmatireis"}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vorrat-ort">Wo liegt es?</Label>
          <select
            id="vorrat-ort"
            value={ort}
            onChange={(e) => setOrt(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {orte.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="vorrat-menge">Wie viel?</Label>
          <Input
            id="vorrat-menge"
            type="number"
            min={art === "cooked" ? 0.25 : 1}
            step={art === "cooked" ? 0.5 : 10}
            value={menge}
            onChange={(e) => setMenge(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vorrat-einheit">Einheit</Label>
          <Input
            id="vorrat-einheit"
            value={eigeneEinheit}
            onChange={(e) => setEigeneEinheit(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vorrat-kategorie">Kategorie</Label>
          <select
            id="vorrat-kategorie"
            value={bereich}
            onChange={(e) => setBereich(e.target.value as StoreCategoryWert)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {(Object.keys(STORE_CATEGORY_LABELS) as StoreCategoryWert[]).map((k) => (
              <option key={k} value={k}>
                {STORE_CATEGORY_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vorrat-haltbar">Haltbar bis</Label>
          <Input
            id="vorrat-haltbar"
            type="date"
            min={heute()}
            value={haltbar}
            onChange={(e) => setHaltbar(e.target.value)}
          />
        </div>
      </div>

      {posten?.bestBefore && istVergangen(posten.bestBefore) ? (
        <p className="text-sm text-destructive">
          Dieser Posten ist seit {zeigeDatum(posten.bestBefore)} abgelaufen.
        </p>
      ) : null}

      {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={laeuft || name.trim() === ""}>
          {laeuft ? "Speichert …" : posten ? "Speichern" : "Anlegen"}
        </Button>
        <Button type="button" variant="ghost" onClick={onAbbruch}>
          Abbrechen
        </Button>
      </div>

      {!posten ? (
        <p className="text-sm text-muted-foreground">
          Gleichartige Posten werden zusammengefasst: Legst du zweimal Reis mit
          demselben Ort und Datum an, steht danach die Summe da – keine zweite
          Zeile.
        </p>
      ) : null}
    </form>
  );
}
