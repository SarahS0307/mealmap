"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
