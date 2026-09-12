import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Plan – MealMap" };

export default function PlanPage() {
  return (
    <ModulePlaceholder
      title="Plan"
      description="Dein Meal-Prep-Plan, Tag für Tag – mit getrenntem Koch- und Essenstermin."
      chips={[
        { label: "Frühstück", variant: "breakfast" },
        { label: "Snack", variant: "snack" },
        { label: "Mittagessen", variant: "lunch" },
        { label: "Snack", variant: "snack" },
        { label: "Abendessen", variant: "dinner" },
        { label: "Sonstiges", variant: "other" },
        { label: "Vorschlag", variant: "suggestion" },
      ]}
      phase="Phase 4 und 5"
      upcoming={[
        "Datumsweise Ansicht mit Frühstück, zwei Snacks, Mittag, Abend und Sonstiges",
        "Marker für Abwesenheit, Einkaufstage und für wen gekocht wird",
        "Später: automatische Vorschläge nach deinem Sonntagsrhythmus",
        "Später: Vorratsübersicht und automatische Mengenskalierung",
      ]}
    />
  );
}
