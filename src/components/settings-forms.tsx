"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/components/session-provider";
import { api } from "@/lib/api";

type Meldung = { art: "ok" | "fehler"; text: string } | null;

function MeldungsZeile({ meldung }: { meldung: Meldung }) {
  if (!meldung) return null;
  return (
    <p
      className={
        meldung.art === "ok"
          ? "text-sm text-primary"
          : "text-sm text-destructive"
      }
    >
      {meldung.text}
    </p>
  );
}

export function NameForm() {
  const { user, setUser } = useSession();
  const [name, setName] = useState(user?.name ?? "");
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setMeldung(null);
    try {
      const { user: aktualisiert } = await api.rename(name.trim());
      setUser(aktualisiert);
      setMeldung({ art: "ok", text: "Gespeichert." });
    } catch (err) {
      setMeldung({
        art: "fehler",
        text: err instanceof Error ? err.message : "Fehlgeschlagen.",
      });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form onSubmit={speichern} className="space-y-3">
      <Label htmlFor="user-name">Dein Name</Label>
      <Input
        id="user-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        autoComplete="off"
      />
      <p className="text-sm text-muted-foreground">
        Daran erkennt MealMap deine Rezepte, deinen Plan und deine Einkaufsliste.
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={laeuft}>
          {laeuft ? "Speichert …" : "Namen speichern"}
        </Button>
        <MeldungsZeile meldung={meldung} />
      </div>
    </form>
  );
}

/**
 * Bundesland – es entscheidet, welche gesetzlichen Feiertage gelten und damit,
 * an welchen Tagen eingekauft werden kann und wann Sarah mittags daheim ist.
 * Die Liste kommt vom Server, damit sie nur an einer Stelle gepflegt wird.
 */
export function BundeslandForm() {
  const { user, setUser } = useSession();
  const [land, setLand] = useState(user?.state ?? "BW");
  const [laender, setLaender] = useState<{ code: string; name: string }[]>([]);
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    api
      .states()
      .then(({ states }) => setLaender(states))
      .catch(() => setLaender([]));
  }, []);

  useEffect(() => {
    if (user?.state) setLand(user.state);
  }, [user?.state]);

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setMeldung(null);
    try {
      const { user: aktualisiert } = await api.saveState(land);
      setUser(aktualisiert);
      setMeldung({ art: "ok", text: "Gespeichert." });
    } catch (err) {
      setMeldung({
        art: "fehler",
        text: err instanceof Error ? err.message : "Fehlgeschlagen.",
      });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form onSubmit={speichern} className="space-y-3">
      <Label htmlFor="user-state">Bundesland</Label>
      <select
        id="user-state"
        value={land}
        onChange={(e) => setLand(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      >
        {laender.length === 0 ? (
          <option value={land}>{land}</option>
        ) : (
          laender.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))
        )}
      </select>
      <p className="text-sm text-muted-foreground">
        Bestimmt die gesetzlichen Feiertage. Der Plan kennzeichnet sie, und die
        Einkaufsliste weiß, dass die Läden dann zu oder nur eingeschränkt offen
        haben.
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={laeuft}>
          {laeuft ? "Speichert …" : "Bundesland speichern"}
        </Button>
        <MeldungsZeile meldung={meldung} />
      </div>
    </form>
  );
}

/**
 * Persönliche Gewohnheiten als Freitext.
 *
 * Bewusst ohne Struktur und ohne Vorgaben im Code: wann jemand auswärts isst,
 * was er nicht mag, welcher Kochrhythmus passt – das ist bei jeder Person
 * anders. Der Text geht beim Vorschlagen an die KI, die ihn auslegt.
 */
/**
 * Anregungen zum Anklicken. Bewusst als sichtbare Liste und nicht nur als
 * Platzhalter im Feld – der verschwindet beim ersten Buchstaben.
 */
const GEWOHNHEIT_BEISPIELE = [
  "An Werktagen bin ich mittags im Geschäft, deswegen Meal Prep.",
  "Sonntags möglichst für die ganze Woche vorkochen.",
  "An Werktagen kein Frühstück.",
  "Am Wochenende esse ich alle Mahlzeiten zuhause.",
  "Abends höchstens 30 Minuten Aufwand.",
  "Freitagabend bestelle ich meistens.",
  "Zwei Gerichte pro Woche reichen, jedes zweimal.",
  "Kein Fisch, und Pilze mag ich nicht.",
  "Was sich einfrieren lässt, koche ich gern doppelt.",
];

export function GewohnheitenForm() {
  const { user, setUser } = useSession();
  const [text, setText] = useState(user?.habits ?? "");
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    setText(user?.habits ?? "");
  }, [user?.habits]);

  /** Hängt ein Beispiel als eigene Zeile an, ohne Vorhandenes zu überschreiben. */
  function uebernehmen(satz: string) {
    setText((t) => (t.trim() === "" ? satz : `${t.replace(/\s+$/, "")}\n${satz}`));
    setMeldung(null);
  }

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setMeldung(null);
    try {
      const { user: aktualisiert } = await api.saveHabits(text.trim());
      setUser(aktualisiert);
      setMeldung({ art: "ok", text: "Gespeichert." });
    } catch (err) {
      setMeldung({
        art: "fehler",
        text: err instanceof Error ? err.message : "Fehlgeschlagen.",
      });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form onSubmit={speichern} className="space-y-3">
      <Label htmlFor="user-habits">Wie du isst und kochst</Label>
      <Textarea
        id="user-habits"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={4000}
        rows={8}
        placeholder="Schreib es so auf, wie du es jemandem erzählen würdest – ein Punkt je Zeile. Die Beispiele unten kannst du anklicken."
      />

      <div className="space-y-2">
        <p className="text-sm font-medium">Beispiele zum Anklicken</p>
        <div className="flex flex-wrap gap-1.5">
          {GEWOHNHEIT_BEISPIELE.map((b) => {
            const schonDrin = text.includes(b);
            return (
              <Button
                key={b}
                type="button"
                size="sm"
                variant="outline"
                disabled={schonDrin}
                onClick={() => uebernehmen(b)}
                className="h-auto justify-start py-1 text-left text-xs font-normal whitespace-normal"
              >
                {schonDrin ? null : <Plus className="size-3 shrink-0" />}
                {b}
              </Button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Alles frei änderbar – das sind nur Anregungen, keine Vorgaben. Schreib
          ruhig in eigenen Worten, was sonst noch wichtig ist.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Diese Angaben nutzt der Vorschlagsmotor im Plan, wenn oben ein
        API-Schlüssel hinterlegt ist. Ohne Text und ohne Schlüssel füllt er
        einfach die freien Mittag- und Abendslots, ohne etwas über dich
        anzunehmen. {text.length}/4000 Zeichen.
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={laeuft}>
          {laeuft ? "Speichert …" : "Gewohnheiten speichern"}
        </Button>
        <MeldungsZeile meldung={meldung} />
      </div>
    </form>
  );
}

export function ApiKeyForm() {
  const { user, reload } = useSession();
  const [wert, setWert] = useState("");
  const [sichtbar, setSichtbar] = useState(false);
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setMeldung(null);
    try {
      const { hasApiKey } = await api.saveApiKey(wert.trim());
      setWert("");
      await reload();
      setMeldung({
        art: "ok",
        text: hasApiKey ? "Schlüssel gespeichert." : "Schlüssel entfernt.",
      });
    } catch (err) {
      setMeldung({
        art: "fehler",
        text: err instanceof Error ? err.message : "Fehlgeschlagen.",
      });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form onSubmit={speichern} className="space-y-3">
      <Label htmlFor="api-key">Schlüssel für den KI-Import</Label>
      <Input
        id="api-key"
        type={sichtbar ? "text" : "password"}
        value={wert}
        onChange={(e) => setWert(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        placeholder={
          user?.hasApiKey
            ? "Hinterlegt – zum Ersetzen neu eingeben"
            : "Noch nicht hinterlegt"
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={laeuft}>
          {laeuft ? "Speichert …" : "Schlüssel speichern"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setSichtbar((v) => !v)}
        >
          {sichtbar ? "Verbergen" : "Anzeigen"}
        </Button>
        <MeldungsZeile meldung={meldung} />
      </div>
      <p className="text-sm text-muted-foreground">
        Der Schlüssel wird auf dem Server gespeichert und verlässt ihn nie – der
        Browser erfährt nur, ob einer hinterlegt ist. Mit Schlüssel liest MealMap
        Rezepte aus Bildern, PDFs und Links aus. Ohne funktioniert alles Übrige
        unverändert. Das Feld leer zu lassen und zu speichern entfernt ihn.
      </p>
    </form>
  );
}

export function UserSwitcher() {
  const { user, setUser } = useSession();
  const [alle, setAlle] = useState<{ id: string; name: string }[]>([]);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    api
      .users()
      .then(({ users }) => setAlle(users))
      .catch(() => setAlle([]));
  }, [user?.name]);

  const andere = alle.filter((u) => u.id !== user?.id);

  async function wechseln(name: string) {
    setLaeuft(true);
    try {
      const { user: neuer } = await api.signIn(name);
      setUser(neuer);
    } finally {
      setLaeuft(false);
    }
  }

  async function abmelden() {
    setLaeuft(true);
    try {
      await api.signOut();
      setUser(null);
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="space-y-3">
      {andere.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">
            Zu einem anderen Nutzer wechseln – jeder hat seinen eigenen,
            getrennten Datenbestand.
          </p>
          <div className="flex flex-wrap gap-2">
            {andere.map((nutzer) => (
              <Button
                key={nutzer.id}
                type="button"
                variant="outline"
                size="sm"
                disabled={laeuft}
                onClick={() => void wechseln(nutzer.name)}
              >
                Zu {nutzer.name} wechseln
              </Button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Es gibt bisher nur dich. Weitere Nutzer entstehen, sobald sich jemand
          mit einem anderen Namen anmeldet.
        </p>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={laeuft}
        onClick={() => void abmelden()}
      >
        Abmelden
      </Button>
    </div>
  );
}
