import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Rezepte – MealMap" };

export default function RezeptePage() {
  return (
    <ModulePlaceholder
      title="Rezepte"
      description="Deine Rezeptsammlung mit Kategorien, Bewertungen und Kochmodus."
      phase="Phase 2 und 3"
      upcoming={[
        "Rezept per Text anlegen, bearbeiten und löschen",
        "Kategorien frei anlegen, ein Rezept kann in mehreren stehen",
        "Sternebewertung mit Kommentar und Einfrierbar-Kennzeichen",
        "Später: Import aus Bild, PDF und Link, Kochmodus mit Timern, PDF-Export",
      ]}
    />
  );
}
