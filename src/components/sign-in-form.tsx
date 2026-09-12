"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoMark } from "@/components/logo";
import { useSession } from "@/components/session-provider";
import { api } from "@/lib/api";

export function SignInForm({ serverError }: { serverError?: string | null }) {
  const { setUser } = useSession();
  const [name, setName] = useState("");
  const [bekannte, setBekannte] = useState<{ id: string; name: string }[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  // Bereits angelegte Namen als Schnellauswahl anbieten.
  useEffect(() => {
    api
      .users()
      .then(({ users }) => setBekannte(users))
      .catch(() => setBekannte([]));
  }, []);

  async function anmelden(gewaehlterName: string) {
    const sauber = gewaehlterName.trim();
    if (!sauber) {
      setFehler("Bitte gib einen Namen ein.");
      return;
    }

    setLaeuft(true);
    setFehler(null);
    try {
      const { user } = await api.signIn(sauber);
      setUser(user);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-8 py-12 text-center">
      <LogoMark className="size-14 rounded-2xl" />

      <div className="space-y-2">
        <h1 className="text-3xl">Willkommen bei MealMap</h1>
        <p className="text-muted-foreground">
          Sag mir deinen Namen – daran erkenne ich deine Rezepte, deinen Plan und
          deine Einkaufsliste. Ein Passwort brauchst du nicht.
        </p>
      </div>

      <form
        className="w-full space-y-3 text-left"
        onSubmit={(e) => {
          e.preventDefault();
          void anmelden(name);
        }}
      >
        <Label htmlFor="name">Dein Name</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          autoComplete="off"
          maxLength={40}
          placeholder="z. B. Sarah"
          aria-describedby={fehler ? "name-fehler" : undefined}
        />
        {(fehler ?? serverError) ? (
          <p id="name-fehler" className="text-sm text-destructive">
            {fehler ?? serverError}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={laeuft}>
          {laeuft ? "Einen Moment …" : "Loslegen"}
        </Button>
      </form>

      {bekannte.length > 0 ? (
        <div className="w-full space-y-2 border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">Schon mal hier gewesen?</p>
          <div className="flex flex-wrap justify-center gap-2">
            {bekannte.map((nutzer) => (
              <Button
                key={nutzer.id}
                type="button"
                variant="outline"
                size="sm"
                disabled={laeuft}
                onClick={() => void anmelden(nutzer.name)}
              >
                {nutzer.name}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
