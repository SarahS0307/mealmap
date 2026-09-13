"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { GripVertical, Image as BildIcon, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, type ApiCategory, type ApiImage, type RecipeInput } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useRef } from "react";

type ZutatZeile = { name: string; amount: string; unit: string };
type SchrittZeile = { title: string; content: string; timerMinutes: string };

const LEERE_ZUTAT: ZutatZeile = { name: "", amount: "", unit: "" };
const LEERER_SCHRITT: SchrittZeile = { title: "", content: "", timerMinutes: "" };

/**
 * Formular zum Anlegen und Bearbeiten. Ohne `recipeId` wird ein neues Rezept
 * angelegt, sonst das vorhandene geändert.
 */
export function RecipeForm({ recipeId }: { recipeId?: string }) {
  const router = useRouter();

  const [titel, setTitel] = useState("");
  const [notizen, setNotizen] = useState("");
  const [portionen, setPortionen] = useState("2");
  const [dauer, setDauer] = useState("");
  const [einfrierbar, setEinfrierbar] = useState(false);
  const [zutaten, setZutaten] = useState<ZutatZeile[]>([{ ...LEERE_ZUTAT }]);
  const [schritte, setSchritte] = useState<SchrittZeile[]>([{ ...LEERER_SCHRITT }]);
  const [kategorien, setKategorien] = useState<ApiCategory[]>([]);
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  const [quelle, setQuelle] = useState("");
  const [bilder, setBilder] = useState<ApiImage[]>([]);
  const [laedtBild, setLaedtBild] = useState(false);
  const bildFeld = useRef<HTMLInputElement>(null);

  const [laedt, setLaedt] = useState(Boolean(recipeId));
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    try {
      const { categories } = await api.categories();
      setKategorien(categories);

      if (!recipeId) return;

      const { recipe } = await api.recipe(recipeId);
      setTitel(recipe.title);
      setNotizen(recipe.notes ?? "");
      setPortionen(String(recipe.servings));
      setDauer(recipe.prepMinutes ? String(recipe.prepMinutes) : "");
      setEinfrierbar(recipe.freezable);
      setGewaehlt(recipe.categories.map((k) => k.id));
      setQuelle(recipe.sourceUrl ?? "");
      setBilder(recipe.images ?? []);
      setZutaten(
        recipe.ingredients.length > 0
          ? recipe.ingredients.map((z) => ({
              name: z.name,
              amount: z.amount === null ? "" : String(z.amount),
              unit: z.unit ?? "",
            }))
          : [{ ...LEERE_ZUTAT }],
      );
      setSchritte(
        recipe.steps.length > 0
          ? recipe.steps.map((s) => ({
              title: s.title ?? "",
              content: s.content,
              timerMinutes: s.timerSeconds ? String(Math.round(s.timerSeconds / 60)) : "",
            }))
          : [{ ...LEERER_SCHRITT }],
      );
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Laden fehlgeschlagen.");
    } finally {
      setLaedt(false);
    }
  }, [recipeId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    setSpeichert(true);

    const eingabe: RecipeInput = {
      title: titel.trim(),
      notes: notizen.trim(),
      freezable: einfrierbar,
      servings: Number(portionen) || 1,
      prepMinutes: dauer === "" ? null : Number(dauer),
      // Leere Zeilen fallen weg – sie entstehen durch das Anhängen neuer Felder.
      ingredients: zutaten
        .filter((z) => z.name.trim() !== "")
        .map((z) => ({
          name: z.name.trim(),
          amount: z.amount === "" ? null : Number(z.amount),
          unit: z.unit.trim() || null,
        })),
      steps: schritte
        .filter((s) => s.content.trim() !== "")
        .map((s) => ({
          title: s.title.trim() || null,
          content: s.content.trim(),
          timerSeconds: s.timerMinutes === "" ? null : Number(s.timerMinutes) * 60,
        })),
      categoryIds: gewaehlt,
      sourceUrl: quelle.trim() || null,
    };

    try {
      const { recipe } = recipeId
        ? await api.updateRecipe(recipeId, eingabe)
        : await api.createRecipe(eingabe);
      // Bei einem neuen Rezept fragt die Ansicht gleich nach dem Einplanen.
      router.push(
        `/rezepte/ansicht/?id=${recipe.id}${recipeId ? "" : "&neu=1"}`,
      );
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
      setSpeichert(false);
    }
  }

  async function bildHochladen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !recipeId) return;

    setLaedtBild(true);
    setFehler(null);
    try {
      const { file } = await api.upload(f);
      const { image } = await api.addRecipeImage(recipeId, file.url);
      setBilder((alt) => [...alt, image]);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    } finally {
      setLaedtBild(false);
      if (bildFeld.current) bildFeld.current.value = "";
    }
  }

  async function bildEntfernen(imageId: string) {
    if (!recipeId) return;
    try {
      await api.removeRecipeImage(recipeId, imageId);
      setBilder((alt) => alt.filter((b) => b.id !== imageId));
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Entfernen fehlgeschlagen.");
    }
  }

  if (laedt) {
    return <p className="text-muted-foreground">Einen Moment …</p>;
  }

  return (
    <form onSubmit={speichern} className="space-y-8">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="titel">Titel</Label>
          <Input
            id="titel"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            placeholder="z. B. Quinoasalat mit Edamame"
            maxLength={255}
            autoFocus
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="portionen">Portionen</Label>
            <Input
              id="portionen"
              type="number"
              min={1}
              max={99}
              value={portionen}
              onChange={(e) => setPortionen(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dauer">Zubereitungszeit in Minuten</Label>
            <Input
              id="dauer"
              type="number"
              min={0}
              value={dauer}
              onChange={(e) => setDauer(e.target.value)}
              placeholder="optional"
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">Einfrierbar</span>
            <label className="flex h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={einfrierbar}
                onChange={(e) => setEinfrierbar(e.target.checked)}
                className="size-4 accent-(--moss)"
              />
              Lässt sich einfrieren
            </label>
          </div>
        </div>
      </div>

      <Abschnitt titel="Zutaten">
        <div className="space-y-2">
          {zutaten.map((z, i) => (
            <div key={i} className="flex items-center gap-2">
              <GripVertical className="size-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
              <Input
                value={z.amount}
                onChange={(e) => setZutaten(aendere(zutaten, i, { amount: e.target.value }))}
                placeholder="200"
                className="w-20"
                aria-label={`Menge für Zutat ${i + 1}`}
              />
              <Input
                value={z.unit}
                onChange={(e) => setZutaten(aendere(zutaten, i, { unit: e.target.value }))}
                placeholder="g"
                className="w-24"
                aria-label={`Einheit für Zutat ${i + 1}`}
              />
              <Input
                value={z.name}
                onChange={(e) => setZutaten(aendere(zutaten, i, { name: e.target.value }))}
                placeholder="Quinoa"
                className="flex-1"
                aria-label={`Name für Zutat ${i + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Zutat ${i + 1} entfernen`}
                onClick={() => setZutaten(entferne(zutaten, i, LEERE_ZUTAT))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setZutaten([...zutaten, { ...LEERE_ZUTAT }])}
        >
          <Plus className="size-4" />
          Zutat hinzufügen
        </Button>
      </Abschnitt>

      <Abschnitt titel="Zubereitung">
        <div className="space-y-4">
          {schritte.map((s, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                  {i + 1}
                </span>
                <Input
                  value={s.title}
                  onChange={(e) => setSchritte(aendere(schritte, i, { title: e.target.value }))}
                  placeholder="Überschrift, optional"
                  className="flex-1"
                  aria-label={`Überschrift für Schritt ${i + 1}`}
                />
                <Input
                  value={s.timerMinutes}
                  onChange={(e) => setSchritte(aendere(schritte, i, { timerMinutes: e.target.value }))}
                  type="number"
                  min={0}
                  placeholder="Min"
                  className="w-20"
                  aria-label={`Timer in Minuten für Schritt ${i + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Schritt ${i + 1} entfernen`}
                  onClick={() => setSchritte(entferne(schritte, i, LEERER_SCHRITT))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <Textarea
                value={s.content}
                onChange={(e) => setSchritte(aendere(schritte, i, { content: e.target.value }))}
                placeholder="Was ist zu tun?"
                rows={2}
                className="mt-2"
                aria-label={`Beschreibung für Schritt ${i + 1}`}
              />
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSchritte([...schritte, { ...LEERER_SCHRITT }])}
        >
          <Plus className="size-4" />
          Schritt hinzufügen
        </Button>
        <p className="text-sm text-muted-foreground">
          Eine Minutenangabe macht aus dem Schritt später im Kochmodus einen Timer.
        </p>
      </Abschnitt>

      <Abschnitt titel="Bilder">
        {recipeId ? (
          <>
            {bilder.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {bilder.map((b) => (
                  <div key={b.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={b.url}
                      alt=""
                      className="size-28 rounded-lg border border-border object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Bild entfernen"
                      onClick={() => void bildEntfernen(b.id)}
                      className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-destructive text-white"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <input
              ref={bildFeld}
              type="file"
              accept="image/*"
              onChange={bildHochladen}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={laedtBild}
              onClick={() => bildFeld.current?.click()}
            >
              {laedtBild ? <BildIcon className="size-4" /> : <Upload className="size-4" />}
              {laedtBild ? "Lädt hoch …" : "Bild hinzufügen"}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Bilder lassen sich hinzufügen, sobald das Rezept einmal gespeichert
            ist.
          </p>
        )}
      </Abschnitt>

      <Abschnitt titel="Quelle">
        <Input
          value={quelle}
          onChange={(e) => setQuelle(e.target.value)}
          placeholder="https://… (Webseite, YouTube, TikTok)"
          inputMode="url"
          aria-label="Adresse der Quelle"
        />
        <p className="text-sm text-muted-foreground">
          Videos werden in der Rezeptansicht eingebettet, andere Adressen als
          Link gezeigt.
        </p>
      </Abschnitt>

      <Abschnitt titel="Kategorien">
        {kategorien.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Kategorien angelegt.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {kategorien.map((k) => {
              const aktiv = gewaehlt.includes(k.id);
              return (
                <button
                  key={k.id}
                  type="button"
                  aria-pressed={aktiv}
                  onClick={() =>
                    setGewaehlt(
                      aktiv ? gewaehlt.filter((id) => id !== k.id) : [...gewaehlt, k.id],
                    )
                  }
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    aktiv
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {k.name}
                </button>
              );
            })}
          </div>
        )}
      </Abschnitt>

      <Abschnitt titel="Notiz">
        <Textarea
          value={notizen}
          onChange={(e) => setNotizen(e.target.value)}
          placeholder="z. B. Zwiebeln weggelassen, hält sich drei Tage"
          rows={3}
          aria-label="Notiz zum Rezept"
        />
      </Abschnitt>

      {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={speichert || titel.trim() === ""}>
          {speichert ? "Speichert …" : recipeId ? "Änderungen speichern" : "Rezept anlegen"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-xl font-semibold">{titel}</h2>
      {children}
    </section>
  );
}

/** Ändert eine Zeile in einer Liste, ohne die übrigen anzufassen. */
function aendere<T>(liste: T[], index: number, teil: Partial<T>): T[] {
  return liste.map((eintrag, i) => (i === index ? { ...eintrag, ...teil } : eintrag));
}

/** Entfernt eine Zeile. Die letzte wird geleert statt entfernt. */
function entferne<T>(liste: T[], index: number, leer: T): T[] {
  return liste.length === 1 ? [{ ...leer }] : liste.filter((_, i) => i !== index);
}
