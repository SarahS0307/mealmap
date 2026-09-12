"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError, type ApiCategory } from "@/lib/api";

/** Rückfrage beim Löschen einer Kategorie, in der noch Rezepte liegen. */
type Rueckfrage = {
  kategorie: ApiCategory;
  anzahl: number;
};

export default function KategorienPage() {
  const [kategorien, setKategorien] = useState<ApiCategory[]>([]);
  const [neu, setNeu] = useState("");
  const [bearbeitet, setBearbeitet] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState("");
  const [rueckfrage, setRueckfrage] = useState<Rueckfrage | null>(null);
  const [ziel, setZiel] = useState("");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);

  const laden = useCallback(async () => {
    try {
      const { categories } = await api.categories();
      setKategorien(categories);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Laden fehlgeschlagen.");
    } finally {
      setLaedt(false);
    }
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  async function anlegen(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    try {
      await api.createCategory(neu.trim());
      setNeu("");
      await laden();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Anlegen fehlgeschlagen.");
    }
  }

  async function umbenennen(id: string) {
    setFehler(null);
    try {
      await api.renameCategory(id, entwurf.trim());
      setBearbeitet(null);
      await laden();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Umbenennen fehlgeschlagen.");
    }
  }

  async function loeschen(kategorie: ApiCategory, zielId?: string, ohneErsatz = false) {
    setFehler(null);
    try {
      const { movedRecipes } = await api.deleteCategory(kategorie.id, zielId, ohneErsatz);
      setRueckfrage(null);
      setZiel("");
      setMeldung(
        movedRecipes > 0
          ? `„${kategorie.name}“ gelöscht, ${movedRecipes} Rezepte umgehängt.`
          : `„${kategorie.name}“ gelöscht.`,
      );
      await laden();
    } catch (err) {
      // 409 heißt: In der Kategorie liegen noch Rezepte, der Server will wissen,
      // was damit geschehen soll.
      if (err instanceof ApiError && err.status === 409) {
        setRueckfrage({
          kategorie,
          anzahl: Number(err.data.recipeCount ?? 0),
        });
        return;
      }
      setFehler(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
    }
  }

  const andere = rueckfrage
    ? kategorien.filter((k) => k.id !== rueckfrage.kategorie.id)
    : [];

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" render={<Link href="/rezepte/" />}>
        <ArrowLeft className="size-4" />
        Zurück zu den Rezepten
      </Button>

      <div className="space-y-1">
        <h1 className="text-3xl">Kategorien</h1>
        <p className="text-muted-foreground">
          Ein Rezept kann in mehreren Kategorien stehen.
        </p>
      </div>

      <form onSubmit={anlegen} className="flex items-end gap-2">
        <div className="flex-1 space-y-2">
          <Label htmlFor="neue-kategorie">Neue Kategorie</Label>
          <Input
            id="neue-kategorie"
            value={neu}
            onChange={(e) => setNeu(e.target.value)}
            placeholder="z. B. Suppen"
            maxLength={60}
          />
        </div>
        <Button type="submit" disabled={neu.trim() === ""}>
          Anlegen
        </Button>
      </form>

      {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}
      {meldung ? <p className="text-sm text-primary">{meldung}</p> : null}

      {rueckfrage ? (
        <div className="rounded-xl border border-(--amber) bg-card p-5">
          <h2 className="font-heading text-lg font-semibold">
            In „{rueckfrage.kategorie.name}“ liegen {rueckfrage.anzahl}{" "}
            {rueckfrage.anzahl === 1 ? "Rezept" : "Rezepte"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sollen sie vorher einer anderen Kategorie zugewiesen werden? Die
            Rezepte selbst bleiben in jedem Fall erhalten – ohne Zuweisung stehen
            sie danach nur in keiner Kategorie mehr.
          </p>

          {andere.length > 0 ? (
            <div className="mt-4 space-y-2">
              <Label htmlFor="ziel-kategorie">Rezepte verschieben nach</Label>
              <select
                id="ziel-kategorie"
                value={ziel}
                onChange={(e) => setZiel(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">– keine Zuweisung –</option>
                {andere.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() =>
                void loeschen(rueckfrage.kategorie, ziel || undefined, ziel === "")
              }
            >
              {ziel ? "Verschieben und löschen" : "Ohne Zuweisung löschen"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setRueckfrage(null);
                setZiel("");
              }}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      ) : null}

      {laedt ? (
        <p className="text-muted-foreground">Einen Moment …</p>
      ) : kategorien.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
          Noch keine Kategorien.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {kategorien.map((k) => (
            <li key={k.id} className="flex items-center gap-3 p-3">
              {bearbeitet === k.id ? (
                <>
                  <Input
                    value={entwurf}
                    onChange={(e) => setEntwurf(e.target.value)}
                    maxLength={60}
                    autoFocus
                    aria-label={`${k.name} umbenennen`}
                  />
                  <Button size="sm" onClick={() => void umbenennen(k.id)}>
                    <Check className="size-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setBearbeitet(null)}>
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium">{k.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {k.recipeCount ?? 0} {k.recipeCount === 1 ? "Rezept" : "Rezepte"}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`${k.name} umbenennen`}
                    onClick={() => {
                      setBearbeitet(k.id);
                      setEntwurf(k.name);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`${k.name} löschen`}
                    onClick={() => void loeschen(k)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
