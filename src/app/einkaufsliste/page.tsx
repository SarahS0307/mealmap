"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  api,
  type ApiCoveredItem,
  type ApiShoppingItem,
  type ApiStore,
  type StoreCategoryWert,
} from "@/lib/api";
import { STORE_CATEGORY_LABELS } from "@/lib/domain";
import { heute, montag, plusTage, wochentag, zeigeDatum } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Voreinstellung des Zeitraums: ab heute eine Woche. */
const TAGE_VOREINSTELLUNG = 7;

/** Mehr nimmt die API nicht entgegen. */
const TAGE_HOECHSTENS = 60;

/**
 * Die Einkaufsliste.
 *
 * Sie entsteht aus den <strong>bestätigten</strong> Plan-Einträgen einer
 * Woche – Vorschläge zählen nicht, sonst kauft man für etwas ein, das man noch
 * gar nicht kochen wollte. Gleiche Zutaten werden zu einem Posten
 * zusammengefasst, und was der Vorrat schon abdeckt, steht ausgegraut daneben
 * statt zu verschwinden.
 */
export default function EinkaufslistePage() {
  // Der Zeitraum wird vor dem Übernehmen bestätigt, statt still im
  // Hintergrund zu gelten – man soll sehen, wofür eingekauft wird.
  const [zeitraumOffen, setZeitraumOffen] = useState(false);
  const [von, setVon] = useState(() => heute());
  const [bis, setBis] = useState(() => plusTage(heute(), TAGE_VOREINSTELLUNG - 1));
  const [bereiche, setBereiche] = useState<
    { category: StoreCategoryWert; items: ApiShoppingItem[] }[]
  >([]);
  const [erledigt, setErledigt] = useState<ApiShoppingItem[]>([]);
  const [gedeckt, setGedeckt] = useState<ApiCoveredItem[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [rechnet, setRechnet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [formularOffen, setFormularOffen] = useState(false);
  const [frischVorlauf, setFrischVorlauf] = useState(4);
  const [laeden, setLaeden] = useState<ApiStore[]>([]);
  // Doppelklick auf eine Kachel öffnet die Bearbeitung.
  const [bearbeitet, setBearbeitet] = useState<ApiShoppingItem | null>(null);

  const laden = useCallback(async () => {
    try {
      const { sections, done, freshLeadDays } = await api.shoppingList();
      setBereiche(sections);
      setErledigt(done);
      setFrischVorlauf(freshLeadDays);
      const { stores } = await api.stores();
      setLaeden(stores);
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

  async function erzeugen(auchTrotzVorrat: string[] = []) {
    const tage = tageZwischen(von, bis);
    if (tage < 1) {
      setFehler("Das Ende darf nicht vor dem Anfang liegen.");
      return;
    }
    if (tage > TAGE_HOECHSTENS) {
      setFehler(`Höchstens ${TAGE_HOECHSTENS} Tage auf einmal.`);
      return;
    }

    setRechnet(true);
    try {
      const { created, covered, skipped, alreadyBought } =
        await api.generateShoppingList(von, tage, auchTrotzVorrat);
      setGedeckt(covered);
      setHinweis(
        created === 0 && skipped === 0 && alreadyBought === 0
          ? "In dieser Woche sind noch keine Rezepte bestätigt – Vorschläge zählen nicht mit."
          : `${created} Posten aus dem Plan übernommen` +
            (skipped > 0 ? `, ${skipped} deckt schon dein Vorrat` : "") +
            (alreadyBought > 0 ? `, ${alreadyBought} liegt schon im Wagen` : "") +
            ".",
      );
      setFehler(null);
      setZeitraumOffen(false);
      await laden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Erzeugen fehlgeschlagen.");
    } finally {
      setRechnet(false);
    }
  }

  async function abhaken(p: ApiShoppingItem, fertig: boolean) {
    try {
      await api.toggleShoppingItem(p.id, fertig);
      await laden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  }

  /** Ordnet einem Posten einen Laden zu – oder nimmt die Zuordnung weg. */
  async function ladenSetzen(p: ApiShoppingItem, storeId: string) {
    try {
      await api.updateShoppingItem(p.id, {
        name: p.name,
        quantity: p.quantity,
        unit: p.unit,
        storeCategory: p.storeCategory,
        neededByDate: p.neededByDate,
        storeId: storeId || null,
      });
      await laden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  }

  async function loeschen(p: ApiShoppingItem) {
    try {
      await api.deleteShoppingItem(p.id);
      await laden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    }
  }

  async function erledigteWegraeumen() {
    try {
      const { deleted } = await api.clearDoneShoppingItems();
      setHinweis(
        deleted > 0
          ? `${deleted} erledigte ${deleted === 1 ? "Posten" : "Posten"} weggeräumt.`
          : "Es war nichts abgehakt.",
      );
      await laden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Aufräumen fehlgeschlagen.");
    }
  }

  /** Holt einen ausgegrauten Posten doch auf die Liste. */
  async function dochKaufen(g: ApiCoveredItem) {
    try {
      await api.createShoppingItem({
        name: g.name,
        quantity: g.needed,
        unit: g.unit,
      });
      setGedeckt((liste) => liste.filter((x) => x.name !== g.name));
      setHinweis(`${g.name} steht jetzt trotzdem auf der Liste.`);
      await laden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Hinzufügen fehlgeschlagen.");
    }
  }

  const offeneAnzahl = bereiche.reduce((n, b) => n + b.items.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-3xl">Einkaufsliste</h1>
            <span className="text-muted-foreground">
              {wochentag(heute())}, {zeigeDatum(heute())}
            </span>
          </div>
          <p className="text-muted-foreground">
            {offeneAnzahl === 0
              ? "Noch nichts zu holen."
              : `${offeneAnzahl} ${offeneAnzahl === 1 ? "Posten" : "Posten"} offen, nach Bereichen sortiert.`}
          </p>
        </div>
        {!formularOffen ? (
          <Button size="sm" variant="outline" onClick={() => setFormularOffen(true)}>
            <Plus className="size-4" />
            Posten hinzufügen
          </Button>
        ) : null}
      </div>

      {!zeitraumOffen ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setZeitraumOffen(true)}>
            <RefreshCw className="size-4" />
            Aus dem Plan übernehmen
          </Button>
          <span className="text-sm text-muted-foreground">
            Du wählst gleich den Zeitraum. Nur bestätigte Einträge zählen.
          </span>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-primary bg-card p-4">
          <div>
            <h2 className="font-heading text-lg font-semibold">
              Für welchen Zeitraum?
            </h2>
            <p className="text-sm text-muted-foreground">
              Voreingestellt ist ab heute eine Woche. Übernommen werden die
              Zutaten aller <strong>bestätigten</strong> Plan-Einträge darin.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="liste-von">Von</Label>
              <Input
                id="liste-von"
                type="date"
                value={von}
                onChange={(e) => {
                  setVon(e.target.value);
                  // Das Ende mitziehen, wenn es sonst davor läge.
                  if (e.target.value > bis) setBis(e.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="liste-bis">Bis einschließlich</Label>
              <Input
                id="liste-bis"
                type="date"
                min={von}
                value={bis}
                onChange={(e) => setBis(e.target.value)}
              />
            </div>
            <div className="sm:pt-8">
              <p className="text-sm text-muted-foreground">
                {tageZwischen(von, bis) > 0
                  ? `${tageZwischen(von, bis)} ${tageZwischen(von, bis) === 1 ? "Tag" : "Tage"}`
                  : "Das Ende liegt vor dem Anfang."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setVon(heute());
                setBis(plusTage(heute(), TAGE_VOREINSTELLUNG - 1));
              }}
            >
              Ab heute eine Woche
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setVon(montag(plusTage(heute(), 7)));
                setBis(plusTage(montag(plusTage(heute(), 7)), 6));
              }}
            >
              Nächste Woche
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button onClick={() => void erzeugen()} disabled={rechnet}>
              <RefreshCw className={cn("size-4", rechnet && "animate-spin")} />
              {rechnet ? "einen Moment …" : "Übernehmen"}
            </Button>
            <Button variant="ghost" onClick={() => setZeitraumOffen(false)}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}
      {hinweis ? (
        <p className="rounded-lg border border-border bg-accent px-3 py-2 text-sm">
          {hinweis}
        </p>
      ) : null}

      {bearbeitet ? (
        <PostenBearbeiten
          posten={bearbeitet}
          laeden={laeden}
          onFertig={() => {
            setBearbeitet(null);
            void laden();
          }}
          onAbbruch={() => setBearbeitet(null)}
        />
      ) : null}

      {formularOffen ? (
        <PostenForm
          onFertig={() => {
            setFormularOffen(false);
            void laden();
          }}
          onAbbruch={() => setFormularOffen(false)}
        />
      ) : null}

      {laedt ? (
        <p className="text-muted-foreground">Einen Moment …</p>
      ) : offeneAnzahl === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
          Die Liste ist leer. „Aus dem Plan übernehmen“ holt die Zutaten der
          bestätigten Rezepte dieser Woche – oder du trägst selbst etwas ein.
        </p>
      ) : (
        <div className="space-y-6">
          {bereiche.map((b) => (
            <section key={b.category} className="space-y-2">
              <h2 className="font-heading text-lg font-semibold">
                {STORE_CATEGORY_LABELS[b.category]}
              </h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {b.items.map((p) => (
                  <PostenKachel
                    key={p.id}
                    posten={p}
                    laeden={laeden}
                    onAbhaken={() => void abhaken(p, true)}
                    onLoeschen={() => void loeschen(p)}
                    onLadenSetzen={(id) => void ladenSetzen(p, id)}
                    onBearbeiten={() => setBearbeitet(p)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ZweiterEinkauf bereiche={bereiche} vorlauf={frischVorlauf} />

      {gedeckt.length > 0 ? <VorratsTabelle posten={gedeckt} onDochKaufen={dochKaufen} /> : null}

      {erledigt.length > 0 ? (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-lg font-semibold text-muted-foreground">
              Zuletzt erledigt
            </h2>
            <Button size="sm" variant="ghost" onClick={() => void erledigteWegraeumen()}>
              <Trash2 className="size-4" />
              Wegräumen
            </Button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {erledigt.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => void abhaken(p, false)}
                  aria-label={`${p.name} wieder auf die Liste`}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground line-through hover:border-primary hover:no-underline"
                >
                  <span aria-hidden="true">{p.icon}</span>
                  {p.quantity ? `${p.quantity} ${p.unit ?? ""} ` : ""}
                  {p.name}
                  <Undo2 className="size-3.5 shrink-0 no-underline" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Wie viele Tage der Zeitraum umfasst, beide Enden eingeschlossen. */
function tageZwischen(von: string, bis: string): number {
  const [j1, m1, t1] = von.split("-").map(Number);
  const [j2, m2, t2] = bis.split("-").map(Number);
  const a = new Date(j1, m1 - 1, t1).getTime();
  const b = new Date(j2, m2 - 1, t2).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * Hinweis auf einen zweiten Einkaufstermin.
 *
 * Frische Ware, die erst in einigen Tagen gebraucht wird, kauft man besser
 * später – sonst liegt der Salat eine Woche im Kühlschrank. Der Hinweis
 * entfernt nichts von der Liste, er sagt nur, was warten kann.
 */
function ZweiterEinkauf({
  bereiche,
  vorlauf,
}: {
  bereiche: { category: StoreCategoryWert; items: ApiShoppingItem[] }[];
  vorlauf: number;
}) {
  const spaet = bereiche
    .flatMap((b) => b.items)
    .filter((p) => p.perishable && p.daysAhead !== null && p.daysAhead >= vorlauf)
    .sort((a, b) => (a.daysAhead ?? 0) - (b.daysAhead ?? 0));

  if (spaet.length === 0) return null;

  return (
    <section className="rounded-xl border border-(--terracotta) bg-card p-3">
      <h2 className="font-heading text-base font-semibold">
        Lohnt ein zweiter Einkauf
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Das hier ist frische Ware und wird erst in {vorlauf} Tagen oder später
        gebraucht. Wenn du magst, hol sie näher am Kochtag – dann ist sie noch
        frisch.
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {spaet.map((p) => (
          <li
            key={p.id}
            className="rounded-full border border-border px-2.5 py-1 text-sm"
          >
            <span aria-hidden="true">{p.icon}</span> {p.name}
            <span className="text-muted-foreground">
              {" "}
              · in {p.daysAhead} Tagen
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Ein Posten als Kachel.
 *
 * Nebeneinander statt untereinander: Beim Einkaufen sucht man mit den Augen,
 * und ein Raster aus Sinnbildern liest sich schneller als eine lange Spalte.
 * Die ganze Kachel hakt ab — ein großes Ziel, das man im Laden mit einer Hand
 * trifft; der Papierkorb sitzt bewusst klein in der Ecke.
 */
function PostenKachel({
  posten,
  laeden,
  onAbhaken,
  onLoeschen,
  onLadenSetzen,
  onBearbeiten,
}: {
  posten: ApiShoppingItem;
  laeden: ApiStore[];
  onAbhaken: () => void;
  onLoeschen: () => void;
  onLadenSetzen: (storeId: string) => void;
  onBearbeiten: () => void;
}) {
  const braucht = posten.neededByDate;
  const frueh = braucht !== null && braucht < plusTage(heute(), 3);

  // Zu früh zum Kaufen: Der Posten bleibt voll bedienbar, tritt aber zurück –
  // vor allem bei frischer Ware, die bis dahin verdorben wäre.


  // Bei haltbarer Ware stehen mehrere Termine an einem Posten, bei
  // verderblicher immer genau einer.
  const termine =
    posten.neededDates.length > 0
      ? posten.neededDates
      : posten.neededByDate
        ? [{ date: posten.neededByDate, reason: null, buyBy: posten.neededByDate }]
        : [];

  // Zu früh richtet sich nach dem frühesten Termin. Der Posten bleibt voll
  // bedienbar, tritt aber zurück – vor allem bei frischer Ware, die bis dahin
  // verdorben wäre.
  const fruehester = termine[0]?.buyBy ?? null;
  const nochNichtSinnvoll =
    fruehester !== null &&
    fruehester > plusTage(heute(), posten.perishing === "normal" ? 6 : 2);

  return (
    <li className="relative">
      <button
        type="button"
        onClick={onAbhaken}
        onDoubleClick={onBearbeiten}
        aria-label={`${posten.name} abhaken`}
        title="Klick hakt ab, Doppelklick bearbeitet"
        className={cn(
          "flex h-full w-full flex-col items-center gap-1 rounded-xl border border-border",
          "bg-card p-3 pt-4 text-center transition-colors",
          "hover:border-primary hover:bg-accent",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          // Voll bedienbar, nur zurückgenommen – nicht ausgeschaltet.
          nochNichtSinnvoll && "opacity-55",
        )}
      >
        {posten.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posten.imageUrl}
            alt=""
            className="size-12 rounded-lg object-cover"
          />
        ) : (
          <span className="text-3xl leading-none" aria-hidden="true">
            {posten.icon}
          </span>
        )}
        <span className="mt-1 text-sm leading-tight font-medium break-words">
          {posten.name}
        </span>
        {posten.quantity ? (
          <span className="text-sm tabular-nums text-muted-foreground">
            {posten.quantity} {posten.unit ?? ""}
          </span>
        ) : null}
        {/* "Verdirbt schnell" steht bewusst nur im Vorrat: Auf der Liste sagen
            der Kauftag und die Ausgrauung schon genug, und eine Marke an fast
            jeder Kachel fällt nicht mehr auf. */}
        {posten.perishing === "sofort" ? (
          <span className="mt-1 rounded-full bg-(--slot-snack) px-2 py-0.5 text-xs leading-tight font-semibold text-(--slot-snack-foreground)">
            am Kauftag verarbeiten
          </span>
        ) : null}
        {/* Selbst eingetragene Posten sagen nichts weiter – nur Rezepte. */}
        {posten.fromRecipes.length > 0 ? (
          <span className="mt-auto pt-1 text-xs leading-tight text-muted-foreground">
            {posten.fromRecipes.join(", ")}
          </span>
        ) : null}
        {/* Nur das Datum, an dem es gebraucht wird. Fällt das auf einen Tag
            ohne Einkaufsmöglichkeit, steht der Grund in Klammern dahinter. */}
        {termine.length > 0 ? (
          <span
            className={cn(
              "text-xs leading-tight",
              frueh ? "text-(--terracotta)" : "text-muted-foreground",
            )}
          >
            {termine
              .map((t) => zeigeDatum(t.date) + (t.reason ? ` (${t.reason})` : ""))
              .join(" und ")}
          </span>
        ) : null}
        {nochNichtSinnvoll ? (
          <span className="text-xs leading-tight text-muted-foreground italic">
            noch zu früh
          </span>
        ) : null}
      </button>

      <Button
        size="sm"
        variant="ghost"
        aria-label={`${posten.name} von der Liste nehmen`}
        onClick={onLoeschen}
        className="absolute top-0.5 right-0.5 size-7 p-0 text-muted-foreground"
      >
        <Trash2 className="size-3.5" />
      </Button>

      {/* Eigenes Bedienelement statt Teil der Kachel: Ein Klick hierhin soll
          den Laden ändern, nicht den Posten abhaken. */}
      {laeden.length > 0 ? (
        <select
          value={posten.storeId ?? ""}
          onChange={(e) => onLadenSetzen(e.target.value)}
          aria-label={`Laden für ${posten.name}`}
          className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1 text-xs"
        >
          <option value="">– Laden –</option>
          {laeden.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      ) : null}

      <Button
        size="sm"
        variant="ghost"
        aria-label={`${posten.name} bearbeiten`}
        onClick={onBearbeiten}
        className="absolute top-0.5 left-0.5 size-7 p-0 text-muted-foreground"
      >
        <Pencil className="size-3.5" />
      </Button>
    </li>
  );
}

/**
 * Was der Vorrat abdeckt und deshalb nicht auf der Liste steht.
 *
 * Bewusst sichtbar statt stillschweigend weggelassen: Stimmt der Bestand
 * nicht, oder ist die Packung schon angebrochen, holt ein Klick den Posten
 * doch auf die Liste.
 */
function VorratsTabelle({
  posten,
  onDochKaufen,
}: {
  posten: ApiCoveredItem[];
  onDochKaufen: (g: ApiCoveredItem) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-heading text-lg font-semibold text-muted-foreground">
        Hast du schon
      </h2>
      <p className="text-sm text-muted-foreground">
        Diese Zutaten stehen laut Vorrat zuhause und fehlen deshalb auf der
        Liste. Stimmt das nicht, hol sie mit einem Klick dazu.
      </p>
      <ul className="divide-y divide-border rounded-xl border border-dashed border-border">
        {posten.map((g) => (
          <li key={g.name} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1 text-muted-foreground">
              <p className="font-medium">
                {g.needed ? `${g.needed} ${g.unit ?? ""} ` : ""}
                {g.name}
              </p>
              <p className="text-sm">
                {g.fully
                  ? `${g.inStock} ${g.unit ?? ""} im Vorrat – reicht`
                  : `${g.inStock} ${g.unit ?? ""} im Vorrat – ${g.remaining} ${g.unit ?? ""} fehlen noch`}
                {g.recipes.length > 0 ? ` · für ${g.recipes.join(", ")}` : ""}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => onDochKaufen(g)}>
              <Plus className="size-4" />
              Trotzdem kaufen
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Einen Posten von Hand eintragen. */
function PostenForm({
  onFertig,
  onAbbruch,
}: {
  onFertig: () => void;
  onAbbruch: () => void;
}) {
  const [name, setName] = useState("");
  const [menge, setMenge] = useState("");
  const [einheit, setEinheit] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    try {
      await api.createShoppingItem({
        name: name.trim(),
        quantity: menge === "" ? null : Number(menge),
        unit: einheit.trim() || null,
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
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="liste-name">Was?</Label>
          <Input
            id="liste-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Spülmittel"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="liste-menge">Wie viel? (kann leer bleiben)</Label>
          <Input
            id="liste-menge"
            type="number"
            min={0}
            step={0.5}
            value={menge}
            onChange={(e) => setMenge(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="liste-einheit">Einheit</Label>
          <Input
            id="liste-einheit"
            value={einheit}
            onChange={(e) => setEinheit(e.target.value)}
            placeholder="g, Stück, Packung"
          />
        </div>
      </div>

      {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={laeuft || name.trim() === ""}>
          {laeuft ? "Speichert …" : "Hinzufügen"}
        </Button>
        <Button type="button" variant="ghost" onClick={onAbbruch}>
          Abbrechen
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Den Supermarktbereich und das Sinnbild ordnet MealMap selbst zu.
        Handeingaben bleiben stehen, auch wenn du die Liste neu aus dem Plan
        übernimmst.
      </p>
    </form>
  );
}

/** Häufige Sinnbilder zum Anklicken – Tippen geht auch. */
const SINNBILD_VORSCHLAEGE = [
  "🧅", "🥕", "🥔", "🍅", "🥒", "🫑", "🥬", "🍄", "🌿", "🍋",
  "🥛", "🧀", "🧈", "🥚", "🥩", "🍗", "🐟", "🍞", "🍚", "🍝",
  "🫘", "🌾", "🧂", "🫒", "🍫", "☕", "💧", "🧊", "🧴", "🛒",
];

/**
 * Einen Posten bearbeiten – Doppelklick auf die Kachel oder der Stift.
 *
 * Hier lässt sich alles ändern, was die Kachel sonst nur zeigt: Name, Menge,
 * Einheit, Bereich, Laden. Dazu ein <strong>eigenes Bild</strong>, das an die
 * Stelle des geratenen Sinnbilds tritt — ein Foto der Packung erkennt man im
 * Regal schneller als ein Emoji. Und weil man den Laden oft erst hier vermisst,
 * lassen sich Läden gleich von hier aus anlegen.
 */
function PostenBearbeiten({
  posten,
  laeden,
  onFertig,
  onAbbruch,
}: {
  posten: ApiShoppingItem;
  laeden: ApiStore[];
  onFertig: () => void;
  onAbbruch: () => void;
}) {
  const [name, setName] = useState(posten.name);
  const [menge, setMenge] = useState(posten.quantity?.toString() ?? "");
  const [einheit, setEinheit] = useState(posten.unit ?? "");
  const [bereich, setBereich] = useState<StoreCategoryWert>(posten.storeCategory);
  const [ladenId, setLadenId] = useState(posten.storeId ?? "");
  const [bild, setBild] = useState<string | null>(posten.imageUrl);
  const [sinnbild, setSinnbild] = useState(posten.icon);
  const [alleLaeden, setAlleLaeden] = useState(laeden);
  const [neuerLaden, setNeuerLaden] = useState("");
  const [laedtBild, setLaedtBild] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function bildWaehlen(e: React.ChangeEvent<HTMLInputElement>) {
    const datei = e.target.files?.[0];
    if (!datei) return;
    setLaedtBild(true);
    try {
      const { file } = await api.upload(datei);
      setBild(file.url);
      setFehler(null);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Hochladen fehlgeschlagen.");
    } finally {
      setLaedtBild(false);
      e.target.value = "";
    }
  }

  async function ladenAnlegen() {
    if (neuerLaden.trim() === "") return;
    try {
      const { store } = await api.createStore(neuerLaden.trim());
      setAlleLaeden((l) => [...l, store]);
      setLadenId(store.id);
      setNeuerLaden("");
      setFehler(null);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Laden anlegen fehlgeschlagen.");
    }
  }

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    try {
      await api.updateShoppingItem(posten.id, {
        name: name.trim(),
        quantity: menge === "" ? null : Number(menge),
        unit: einheit.trim() || null,
        storeCategory: bereich,
        neededByDate: posten.neededByDate,
        storeId: ladenId || null,
        // Leerer String entfernt das Bild, ein Pfad setzt es.
        imageUrl: bild ?? "",
        icon: sinnbild,
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
      className="space-y-4 rounded-xl border border-primary bg-card p-4"
    >
      <h2 className="font-heading text-lg font-semibold">Posten bearbeiten</h2>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="bearbeiten-name">Name</Label>
          <Input
            id="bearbeiten-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bearbeiten-menge">Menge</Label>
          <Input
            id="bearbeiten-menge"
            type="number"
            min={0}
            step={0.5}
            value={menge}
            onChange={(e) => setMenge(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bearbeiten-einheit">Einheit</Label>
          <Input
            id="bearbeiten-einheit"
            value={einheit}
            onChange={(e) => setEinheit(e.target.value)}
            placeholder="g, Stück"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bearbeiten-bereich">Bereich im Laden</Label>
          <select
            id="bearbeiten-bereich"
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
          <Label htmlFor="bearbeiten-laden">Laden (freiwillig)</Label>
          <select
            id="bearbeiten-laden"
            value={ladenId}
            onChange={(e) => setLadenId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">– kein bestimmter –</option>
            {alleLaeden.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <Input
              value={neuerLaden}
              onChange={(e) => setNeuerLaden(e.target.value)}
              placeholder="Neuen Laden anlegen"
              className="flex-1"
              aria-label="Neuen Laden anlegen"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void ladenAnlegen()}
              disabled={neuerLaden.trim() === ""}
            >
              Anlegen
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Umbenennen und Entfernen gehen in den Einstellungen.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bearbeiten-icon">Sinnbild</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="bearbeiten-icon"
            value={sinnbild}
            onChange={(e) => setSinnbild(e.target.value)}
            className="w-20 text-center text-2xl"
            maxLength={4}
            aria-describedby="bearbeiten-icon-hilfe"
          />
          <div className="flex flex-wrap gap-1">
            {SINNBILD_VORSCHLAEGE.map((e) => (
              <Button
                key={e}
                type="button"
                variant="outline"
                size="sm"
                className="size-9 p-0 text-lg"
                aria-label={`Sinnbild ${e} wählen`}
                onClick={() => setSinnbild(e)}
              >
                {e}
              </Button>
            ))}
          </div>
        </div>
        <p id="bearbeiten-icon-hilfe" className="text-xs text-muted-foreground">
          Leer lassen, damit MealMap es wieder selbst aus dem Namen rät. Ein
          eigenes Bild unten ersetzt das Sinnbild ganz.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bearbeiten-bild">Eigenes Bild statt Sinnbild</Label>
        <div className="flex flex-wrap items-center gap-3">
          {bild ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bild} alt="" className="size-16 rounded-lg object-cover" />
          ) : (
            <span className="flex size-16 items-center justify-center rounded-lg border border-dashed border-border text-3xl">
              {posten.icon}
            </span>
          )}
          <Input
            id="bearbeiten-bild"
            type="file"
            accept="image/*"
            onChange={(e) => void bildWaehlen(e)}
            className="max-w-xs"
          />
          {bild ? (
            <Button type="button" variant="ghost" onClick={() => setBild(null)}>
              Bild entfernen
            </Button>
          ) : null}
        </div>
        {laedtBild ? (
          <p className="text-sm text-muted-foreground">Bild wird hochgeladen …</p>
        ) : null}
      </div>

      {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={laeuft || name.trim() === ""}>
          {laeuft ? "Speichert …" : "Speichern"}
        </Button>
        <Button type="button" variant="ghost" onClick={onAbbruch}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
