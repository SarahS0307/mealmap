import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Einstellungen – MealMap" };

export default function EinstellungenPage() {
  return (
    <ModulePlaceholder
      title="Einstellungen"
      description="Nutzer, Standardvorgaben und der Schlüssel für den KI-Import."
      phase="Phase 1"
      upcoming={[
        "Name eingeben und Nutzer wechseln",
        "API-Key für den KI-Import hinterlegen – ohne Key läuft die App manuell weiter",
        "Standardvorbelegung: kein Frühstück zuhause, Mittagessen im Geschäft",
      ]}
    />
  );
}
