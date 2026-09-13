"use client";

import { useCallback, useEffect, useState } from "react";
import { Minus, Plus, Snowflake, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type ApiStockItem } from "@/lib/api";
import { heute, istVergangen, zeigeDatum } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Der Vorrat: was vorgekocht, eingefroren oder sonst vorrätig ist.
 *
 * Gezählt wird in Portionen – so gibt Sarah es an: „vier Portionen Reis
 * eingefroren“. Der Bestand wächst beim Einfrieren aus dem Plan heraus und
 * sinkt, sobald eine Mahlzeit als gegessen abgehakt wird; von Hand geht beides
 * ebenfalls, weil kein Bestand ohne Nachpflege stimmt.
 */
export default function VorratPage() {
  const [posten, setPosten] = useState<ApiStockItem[]>([]);
  const [orte, setOrte] = useState<string[]>([]);
  const [einheit, setEinheit] = useState("Portion");
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [formularOffen, setFormularOffen] = useState(false);

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

  async function abbuchen(p: ApiStockItem, menge: number) {
    try {
      await api.takeStock(p.id, menge);
      await laden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Abbuchen fehlgeschlagen.");
    }
  }

  async function aufstocken(p: ApiStockItem, menge: number) {
    try {
      await api.updateStockItem(p.id, {
        name: p.name,
        quantity: p.quantity + menge,
        unit: p.unit,
        location: p.location,
        recipeId: p.recipeId,
        bestBefore: p.bestBefore,
      });
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

  // Nach Ort gruppieren – man sucht im Gefrierschrank, nicht in einer Liste.
  const gruppen = new Map<string, ApiStockItem[]>();
  for (const p of posten) {
    const ort = p.location ?? "Ohne Ort";
    gruppen.set(ort, [...(gruppen.get(ort) ?? []), p]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl">Vorrat</h1>
          <p className="text-muted-foreground">
            Was vorgekocht und eingefroren ist – gezählt in {einheit}en.
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

      {laedt ? (
        <p className="text-muted-foreground">Einen Moment …</p>
      ) : posten.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
          Noch nichts im Vorrat. Was du im Plan als gekocht abhakst, kannst du
          dort einfrieren – oder du legst hier von Hand einen Posten an.
        </p>
      ) : (
        <div className="space-y-6">
          {[...gruppen.entries()].map(([ort, liste]) => (
            <section key={ort} className="space-y-2">
              <h2 className="font-heading text-lg font-semibold">{ort}</h2>
              <ul className="space-y-2">
                {liste.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.quantity} {p.unit}
                        {p.quantity === 1 ? "" : "en"}
                        {p.recipeTitle ? ` · aus ${p.recipeTitle}` : ""}
                        {p.bestBefore ? (
                          <span
                            className={cn(
                              istVergangen(p.bestBefore) && "text-destructive",
                            )}
                          >
                            {" "}
                            · haltbar bis {zeigeDatum(p.bestBefore)}
                            {istVergangen(p.bestBefore) ? " (abgelaufen)" : ""}
                          </span>
                        ) : null}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Eine ${p.unit} ${p.name} abziehen`}
                        onClick={() => void abbuchen(p, 1)}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="w-10 text-center tabular-nums">
                        {p.quantity}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Eine ${p.unit} ${p.name} dazu`}
                        onClick={() => void aufstocken(p, 1)}
                      >
                        <Plus className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`${p.name} ganz entfernen`}
                        onClick={() => void loeschen(p)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="border-t border-border pt-4 text-sm text-muted-foreground">
        <Snowflake className="mr-1.5 inline size-4" aria-hidden="true" />
        Der Bestand sinkt von selbst, sobald du im Plan eine Mahlzeit als
        gegessen abhakst, die aus dem Vorrat kommt. Nimmst du den Haken zurück,
        kommt er wieder.
      </p>
    </div>
  );
}

/** Posten von Hand anlegen – für alles, was nicht aus dem Plan kommt. */
function VorratForm({
  orte,
  einheit,
  onFertig,
  onAbbruch,
}: {
  orte: string[];
  einheit: string;
  onFertig: () => void;
  onAbbruch: () => void;
}) {
  const [name, setName] = useState("");
  const [menge, setMenge] = useState("1");
  const [eigeneEinheit, setEigeneEinheit] = useState(einheit);
  const [ort, setOrt] = useState(orte[0] ?? "");
  const [haltbar, setHaltbar] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    try {
      await api.createStockItem({
        name: name.trim(),
        quantity: Number(menge) || 0,
        unit: eigeneEinheit.trim() || einheit,
        location: ort || null,
        bestBefore: haltbar || null,
      });
      onFertig();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
      setLaeuft(false);
    }
  }

  return (
    <form
      onSubmit={speichern}
      className="space-y-4 rounded-xl border border-border bg-card p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="vorrat-name">Was ist es?</Label>
          <Input
            id="vorrat-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Reis"
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

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="vorrat-menge">Wie viel?</Label>
          <Input
            id="vorrat-menge"
            type="number"
            min={0.25}
            step={0.25}
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
          <Label htmlFor="vorrat-haltbar">Haltbar bis (wenn bekannt)</Label>
          <Input
            id="vorrat-haltbar"
            type="date"
            min={heute()}
            value={haltbar}
            onChange={(e) => setHaltbar(e.target.value)}
          />
        </div>
      </div>

      {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={laeuft || name.trim() === ""}>
          {laeuft ? "Speichert …" : "Anlegen"}
        </Button>
        <Button type="button" variant="ghost" onClick={onAbbruch}>
          Abbrechen
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Gleichartige Posten werden zusammengefasst: Legst du zweimal Reis mit
        demselben Ort und Datum an, steht danach die Summe da – keine zweite
        Zeile.
      </p>
    </form>
  );
}
