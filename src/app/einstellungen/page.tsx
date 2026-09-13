"use client";

import {
  ApiKeyForm,
  BundeslandForm,
  GewohnheitenForm,
  LaedenForm,
  NameForm,
  UserSwitcher,
} from "@/components/settings-forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSession } from "@/components/session-provider";
import { ThemeSwitch } from "@/components/theme-switch";

export default function EinstellungenPage() {
  const { user } = useSession();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl">Einstellungen</h1>
        <p className="text-muted-foreground">
          Angemeldet als{" "}
          <strong className="text-foreground">{user?.name}</strong>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nutzer</CardTitle>
          <CardDescription>Wer gerade kocht und plant.</CardDescription>
        </CardHeader>
        <CardContent>
          <NameForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deine Gewohnheiten</CardTitle>
          <CardDescription>
            Was der Plan über dich wissen muss – in eigenen Worten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GewohnheitenForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Läden</CardTitle>
          <CardDescription>
            Wo du einkaufst – für die Einkaufsliste, freiwillig.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LaedenForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feiertage</CardTitle>
          <CardDescription>
            Welche Feiertage für dich gelten, hängt am Bundesland.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BundeslandForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Darstellung</CardTitle>
          <CardDescription>Hell, dunkel oder wie dein Gerät.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSwitch />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>KI-Import</CardTitle>
          <CardDescription>
            Optional. Wird für Rezept-Import aus Bild, PDF und Link sowie für
            Kategorie-Vorschläge benutzt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApiKeyForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nutzer wechseln</CardTitle>
          <CardDescription>
            MealMap kennt kein Passwort – der Name genügt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserSwitcher />
        </CardContent>
      </Card>
    </div>
  );
}
