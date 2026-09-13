"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  FileText,
  Image as BildIcon,
  Link as LinkIcon,
  Loader2,
  Type,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  api,
  type ApiCategory,
  type ApiImportedRecipe,
  type RecipeInput,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Quelle = "text" | "link" | "datei";

const QUELLEN: { wert: Quelle; label: string; icon: typeof Type }[] = [
  { wert: "text", label: "Text", icon: Type },
  { wert: "link", label: "Link", icon: LinkIcon },
  { wert: "datei", label: "Bild oder PDF", icon: Upload },
];

/**
 * Rezepte aus Text, Link, Bild oder PDF übernehmen.
 *
 * Zweistufig: Erst wird gelesen und gezeigt, was erkannt wurde, erst danach
 * gespeichert. Eine Quelle kann mehrere Rezepte enthalten – die erscheinen
 * einzeln und lassen sich einzeln abwählen.
 *
 * Ohne hinterlegten Schlüssel bleibt die Handeingabe der Weg; das sagt die
 * Oberfläche dann auch, statt einen Knopf anzubieten, der nicht funktioniert.
 */
export function RecipeImport() {
  const router = useRouter();
  const dateiFeld = useRef<HTMLInputElement>(null);

  const [verfuegbar, setVerfuegbar] = useState<boolean | null>(null);
  const [grund, setGrund] = useState<string | null>(null);
  const [quelle, setQuelle] = useState<Quelle>("text");
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [datei, setDatei] = useState<{ name: string; url: string } | null>(null);

  const [laeuft, setLaeuft] = useState(false);
  const [schritt, setSchritt] = useState<"eingabe" | "vorschau">("eingabe");
  const [gefunden, setGefunden] = useState<ApiImportedRecipe[]>([]);
  const [gewaehlt, setGewaehlt] = useState<Set<number>>(new Set());
  const [aufgeklappt, setAufgeklappt] = useState<Set<number>>(new Set());
  const [vorhandene, setVorhandene] = useState<ApiCategory[]>([]);
  const [quellUrl, setQuellUrl] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    api
      .importStatus()
      .then(({ available, reason }) => {
        setVerfuegbar(available);
        setGrund(reason);
      })
      .catch(() => setVerfuegbar(false));
  }, []);

  const zuruecksetzen = useCallback(() => {
    setSchritt("eingabe");
    setGefunden([]);
    setGewaehlt(new Set());
    setAufgeklappt(new Set());
    setFehler(null);
  }, []);

  async function dateiWaehlen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    setLaeuft(true);
    setFehler(null);
    try {
      const { file } = await api.upload(f);
      setDatei({ name: f.name, url: file.url });
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    } finally {
      setLaeuft(false);
      if (dateiFeld.current) dateiFeld.current.value = "";
    }
  }

  async function lesen() {
    setLaeuft(true);
    setFehler(null);
    try {
      const eingabe =
        quelle === "text"
          ? { text }
          : quelle === "link"
            ? { url: link.trim() }
            : { uploadUrl: datei?.url };

      const { recipes, existingCategories, sourceUrl } = await api.importRead(eingabe);

      if (recipes.length === 0) {
        setFehler("Darin war kein Rezept zu finden.");
        return;
      }

      setGefunden(recipes);
      setVorhandene(existingCategories);
      setQuellUrl(sourceUrl ?? (quelle === "link" ? link.trim() : null));
      // Alles vorausgewählt – Abwählen ist seltener als Übernehmen.
      setGewaehlt(new Set(recipes.map((_, i) => i)));
      setAufgeklappt(recipes.length === 1 ? new Set([0]) : new Set());
      setSchritt("vorschau");
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Lesen fehlgeschlagen.");
    } finally {
      setLaeuft(false);
    }
  }

  /** Ordnet Kategorienamen zu – vorhandene wiederverwenden, fehlende anlegen. */
  async function kategorienZuordnen(namen: string[]): Promise<string[]> {
    const ids: string[] = [];
    let bekannt = [...vorhandene];

    for (const name of namen.slice(0, 3)) {
      const sauber = name.trim();
      if (!sauber) continue;

      const treffer = bekannt.find(
        (k) => k.name.toLowerCase() === sauber.toLowerCase(),
      );
      if (treffer) {
        ids.push(treffer.id);
        continue;
      }

      try {
        const { category } = await api.createCategory(sauber);
        bekannt = [...bekannt, category];
        ids.push(category.id);
      } catch {
        // Kategorie ließ sich nicht anlegen – das Rezept trotzdem speichern.
      }
    }

    setVorhandene(bekannt);
    return ids;
  }

  async function uebernehmen() {
    setLaeuft(true);
    setFehler(null);

    const auswahl = gefunden.filter((_, i) => gewaehlt.has(i));
    const angelegt: string[] = [];

    try {
      for (const r of auswahl) {
        const categoryIds = await kategorienZuordnen(r.categories ?? []);
        const eingabe: RecipeInput = {
          title: r.title,
          notes: r.notes ?? "",
          freezable: Boolean(r.freezable),
          servings: r.servings || 2,
          prepMinutes: r.prepMinutes,
          ingredients: r.ingredients ?? [],
          steps: r.steps ?? [],
          categoryIds,
          sourceUrl: quellUrl,
        };
        const { recipe } = await api.createRecipe(eingabe);
        angelegt.push(recipe.id);
      }

      // Ein einzelnes Rezept direkt öffnen, bei mehreren in die Liste.
      router.push(
        angelegt.length === 1
          ? `/rezepte/ansicht/?id=${angelegt[0]}`
          : "/rezepte/",
      );
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
      setLaeuft(false);
    }
  }

  // --- Ansicht ---

  if (verfuegbar === null) {
    return <p className="text-muted-foreground">Einen Moment …</p>;
  }

  if (schritt === "vorschau") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-xl font-semibold">
            {gefunden.length === 1
              ? "Ein Rezept gefunden"
              : `${gefunden.length} Rezepte gefunden`}
          </h2>
          <Button variant="ghost" size="sm" onClick={zuruecksetzen}>
            Andere Quelle
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Prüfe, was erkannt wurde. Gespeichert wird erst, wenn du es
          übernimmst – und nur, was angehakt ist.
        </p>

        <ul className="space-y-2">
          {gefunden.map((r, i) => (
            <li key={i} className="rounded-xl border border-border bg-card">
              <div className="flex items-start gap-3 p-4">
                <input
                  type="checkbox"
                  checked={gewaehlt.has(i)}
                  onChange={() =>
                    setGewaehlt((alt) => {
                      const neu = new Set(alt);
                      if (neu.has(i)) neu.delete(i);
                      else neu.add(i);
                      return neu;
                    })
                  }
                  className="mt-1 size-4 accent-(--moss)"
                  aria-label={`${r.title} übernehmen`}
                />
                <div className="flex-1 space-y-1">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.ingredients?.length ?? 0} Zutaten ·{" "}
                    {r.steps?.length ?? 0} Schritte · {r.servings} Portionen
                    {r.prepMinutes ? ` · ${r.prepMinutes} Min` : ""}
                  </p>
                  {r.categories?.length ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {r.categories.map((k) => (
                        <span
                          key={k}
                          className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={aufgeklappt.has(i)}
                  aria-label="Einzelheiten anzeigen"
                  onClick={() =>
                    setAufgeklappt((alt) => {
                      const neu = new Set(alt);
                      if (neu.has(i)) neu.delete(i);
                      else neu.add(i);
                      return neu;
                    })
                  }
                >
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform",
                      aufgeklappt.has(i) && "rotate-180",
                    )}
                  />
                </Button>
              </div>

              {aufgeklappt.has(i) ? (
                <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Zutaten
                    </p>
                    <ul className="space-y-1 text-sm">
                      {r.ingredients?.map((z, j) => (
                        <li key={j}>
                          <span className="text-muted-foreground tabular-nums">
                            {z.amount ?? ""} {z.unit ?? ""}
                          </span>{" "}
                          {z.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Zubereitung
                    </p>
                    <ol className="space-y-1.5 text-sm">
                      {r.steps?.map((st, j) => (
                        <li key={j} className="text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {j + 1}.
                          </span>{" "}
                          {st.title ? <strong>{st.title}: </strong> : null}
                          {st.content}
                          {st.timerSeconds ? (
                            <span className="text-(--terracotta)">
                              {" "}
                              ({Math.round(st.timerSeconds / 60)} Min)
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void uebernehmen()} disabled={laeuft || gewaehlt.size === 0}>
            {laeuft ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Speichert …
              </>
            ) : (
              `${gewaehlt.size} ${gewaehlt.size === 1 ? "Rezept" : "Rezepte"} übernehmen`
            )}
          </Button>
          <Button variant="ghost" onClick={zuruecksetzen} disabled={laeuft}>
            Verwerfen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {verfuegbar === false ? (
        <div className="rounded-xl border border-dashed border-border p-5">
          <p className="font-medium">Import noch nicht eingerichtet</p>
          <p className="mt-1 text-sm text-muted-foreground">{grund}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => router.push("/einstellungen/")}>
              Zu den Einstellungen
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/rezepte/neu/")}
            >
              Rezept von Hand eingeben
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {QUELLEN.map(({ wert, label, icon: Icon }) => (
              <button
                key={wert}
                type="button"
                onClick={() => {
                  setQuelle(wert);
                  setFehler(null);
                }}
                aria-pressed={quelle === wert}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  quelle === wert
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>

          {quelle === "text" ? (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder={"Rezept hier einfügen – Zutaten und Zubereitung.\nAuch mehrere Rezepte auf einmal."}
              aria-label="Rezepttext"
            />
          ) : null}

          {quelle === "link" ? (
            <div className="space-y-2">
              <Input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…"
                inputMode="url"
                aria-label="Adresse der Seite"
              />
              <p className="text-sm text-muted-foreground">
                Webseiten mit Rezepten. Bei TikTok oder Instagram wird nur
                gelesen, was im Text der Seite steht – das Video selbst kann
                MealMap nicht ansehen.
              </p>
            </div>
          ) : null}

          {quelle === "datei" ? (
            <div className="space-y-2">
              <input
                ref={dateiFeld}
                type="file"
                accept="image/*,application/pdf"
                onChange={dateiWaehlen}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => dateiFeld.current?.click()}
                disabled={laeuft}
              >
                {datei ? <BildIcon className="size-4" /> : <Upload className="size-4" />}
                {datei ? "Andere Datei wählen" : "Datei auswählen"}
              </Button>
              {datei ? (
                <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="size-4" />
                  {datei.name}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Foto einer Rezeptseite, ein Bildschirmfoto oder ein PDF.
                  Höchstens 12 MB.
                </p>
              )}
            </div>
          ) : null}

          {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void lesen()}
              disabled={
                laeuft ||
                (quelle === "text" && text.trim().length < 20) ||
                (quelle === "link" && link.trim() === "") ||
                (quelle === "datei" && !datei)
              }
            >
              {laeuft ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Liest …
                </>
              ) : (
                "Rezepte auslesen"
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push("/rezepte/neu/")}
            >
              Lieber von Hand eingeben
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Jeder Import kostet etwas über deinen hinterlegten Schlüssel.
            Gespeichert wird erst, nachdem du dir angesehen hast, was erkannt
            wurde.
          </p>
        </>
      )}
    </div>
  );
}
