"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, type ApiChange, type ApiRecipe } from "@/lib/api";

/**
 * Schnelle Änderung am Rezept in Alltagssprache: „2 statt 3 Eier“.
 *
 * Bewusst zweistufig – erst zeigt die App, was sie verstanden hat, dann wird
 * geschrieben. Die Änderung landet direkt im Rezept, nicht als Notiz daneben.
 */
export function RecipeAdjust({
  recipe,
  offen,
  onClose,
  onChanged,
}: {
  recipe: ApiRecipe;
  offen: boolean;
  onClose: () => void;
  onChanged: (rezept: ApiRecipe) => void;
}) {
  const [wunsch, setWunsch] = useState("");
  const [vorschau, setVorschau] = useState<ApiChange[] | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function pruefen() {
    setLaeuft(true);
    setFehler(null);
    try {
      const { changes } = await api.adjustRecipe(recipe.id, wunsch);
      setVorschau(changes);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Deuten fehlgeschlagen.");
    } finally {
      setLaeuft(false);
    }
  }

  async function uebernehmen() {
    setLaeuft(true);
    setFehler(null);
    try {
      const { recipe: neu } = await api.adjustRecipe(recipe.id, wunsch, true);
      if (neu) onChanged(neu);
      schliessen();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Übernehmen fehlgeschlagen.");
    } finally {
      setLaeuft(false);
    }
  }

  function schliessen() {
    setWunsch("");
    setVorschau(null);
    setFehler(null);
    onClose();
  }

  if (!offen) return null;

  const verstanden = vorschau?.filter((a) => a.art !== "unklar") ?? [];
  const unklar = vorschau?.filter((a) => a.art === "unklar") ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h2 className="font-heading text-lg font-semibold">Was soll geändert werden?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Eine Änderung pro Zeile. Zum Beispiel: <em>2 statt 3 Eier</em>,{" "}
          <em>ohne Zwiebeln</em>, <em>300 g Mehl</em>,{" "}
          <em>Butter durch Öl ersetzen</em>. Die Änderung wird direkt ins Rezept
          eingearbeitet.
        </p>
      </div>

      <Textarea
        value={wunsch}
        onChange={(e) => {
          setWunsch(e.target.value);
          setVorschau(null);
        }}
        rows={3}
        placeholder={"2 statt 3 Eier\nohne Zwiebeln"}
        aria-label="Änderungswunsch"
        autoFocus
      />

      {vorschau ? (
        <div className="space-y-2">
          {verstanden.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {verstanden.map((a, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden="true" className="text-primary">
                    →
                  </span>
                  <span>{beschreibe(a)}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {unklar.length > 0 ? (
            <ul className="space-y-1 text-sm text-(--amber)">
              {unklar.map((a, i) => (
                <li key={i}>
                  „{a.text}“ – {a.grund}
                </li>
              ))}
            </ul>
          ) : null}

          {verstanden.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Davon lässt sich nichts übernehmen. Beliebige Sätze versteht die App
              erst, wenn der KI-Import dazukommt.
            </p>
          ) : null}
        </div>
      ) : null}

      {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}

      <div className="flex flex-wrap gap-2">
        {vorschau === null ? (
          <Button onClick={() => void pruefen()} disabled={laeuft || wunsch.trim() === ""}>
            {laeuft ? "Prüft …" : "Prüfen"}
          </Button>
        ) : (
          <Button onClick={() => void uebernehmen()} disabled={laeuft || verstanden.length === 0}>
            {laeuft ? "Übernimmt …" : `${verstanden.length} Änderung${verstanden.length === 1 ? "" : "en"} übernehmen`}
          </Button>
        )}
        <Button variant="ghost" onClick={schliessen}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

/** Formuliert eine geplante Änderung in einem lesbaren Satz. */
function beschreibe(a: ApiChange): string {
  const einheit = a.einheit ? ` ${a.einheit}` : "";
  switch (a.art) {
    case "menge":
      return `${a.zutat?.name}: ${a.menge}${einheit}`;
    case "entfernen":
      return `${a.zutat?.name} entfernen`;
    case "ersetzen":
      return `${a.zutat?.name} wird zu ${a.neuerName}`;
    case "hinzufuegen":
      return `${a.menge}${einheit} ${a.name} hinzufügen`;
    default:
      return a.text;
  }
}
