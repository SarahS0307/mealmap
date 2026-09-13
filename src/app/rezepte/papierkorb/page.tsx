"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type ApiTrashedRecipe } from "@/lib/api";

export default function PapierkorbPage() {
  const [rezepte, setRezepte] = useState<ApiTrashedRecipe[]>([]);
  const [frist, setFrist] = useState(30);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [endgueltig, setEndgueltig] = useState<string | null>(null);

  const laden = useCallback(async () => {
    try {
      const { recipes, retentionDays } = await api.trash();
      setRezepte(recipes);
      setFrist(retentionDays);
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

  async function zurueckholen(r: ApiTrashedRecipe) {
    try {
      await api.restoreRecipe(r.id);
      setMeldung(`„${r.title}“ ist wieder in deiner Sammlung.`);
      await laden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Wiederherstellen fehlgeschlagen.");
    }
  }

  async function endgueltigLoeschen(r: ApiTrashedRecipe) {
    try {
      await api.purgeRecipe(r.id);
      setEndgueltig(null);
      setMeldung(`„${r.title}“ wurde endgültig gelöscht.`);
      await laden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" render={<Link href="/rezepte/" />}>
        <ArrowLeft className="size-4" />
        Zurück zu den Rezepten
      </Button>

      <div className="space-y-1">
        <h1 className="text-3xl">Papierkorb</h1>
        <p className="text-muted-foreground">
          Gelöschte Rezepte bleiben {frist} Tage hier liegen und lassen sich
          zurückholen. Danach werden sie von selbst entfernt.
        </p>
      </div>

      {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}
      {meldung ? <p className="text-sm text-primary">{meldung}</p> : null}

      {laedt ? (
        <p className="text-muted-foreground">Einen Moment …</p>
      ) : rezepte.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          Der Papierkorb ist leer.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rezepte.map((r) => (
            <li key={r.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{r.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.remainingDays === 0
                      ? "Wird beim nächsten Aufruf entfernt"
                      : `Noch ${r.remainingDays} ${r.remainingDays === 1 ? "Tag" : "Tage"}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void zurueckholen(r)}>
                    <RotateCcw className="size-4" />
                    Zurückholen
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEndgueltig(r.id)}
                    aria-label={`${r.title} endgültig löschen`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {endgueltig === r.id ? (
                <div className="rounded-lg border border-destructive p-3">
                  <p className="text-sm">
                    „{r.title}“ endgültig löschen? Danach ist es wirklich weg.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void endgueltigLoeschen(r)}
                    >
                      Endgültig löschen
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEndgueltig(null)}>
                      Abbrechen
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
