import { ModulePlaceholder } from "@/components/module-placeholder";
import { MEAL_SLOTS, MEAL_SLOT_LABELS, type MealSlot } from "@/lib/domain";
import type { MealChip } from "@/components/meal-chip";

/** Welche Chip-Farbe zu welchem Slot gehört – Snacks teilen sich eine. */
const SLOT_VARIANTEN: Record<
  MealSlot,
  React.ComponentProps<typeof MealChip>["variant"]
> = {
  breakfast: "breakfast",
  snack_am: "snack",
  lunch: "lunch",
  snack_pm: "snack",
  dinner: "dinner",
  other: "other",
};

export const metadata = { title: "Plan – MealMap" };

export default function PlanPage() {
  return (
    <ModulePlaceholder
      title="Plan"
      description="Dein Meal-Prep-Plan, Tag für Tag – mit getrenntem Koch- und Essenstermin."
      chips={[
        // Aus den zentralen Wertelisten, damit Beschriftungen nicht doppelt
        // gepflegt werden. Die Reihenfolge ist die eines Tagesablaufs.
        ...MEAL_SLOTS.map((slot) => ({
          label: MEAL_SLOT_LABELS[slot],
          variant: SLOT_VARIANTEN[slot],
        })),
        { label: "Vorschlag", variant: "suggestion" as const },
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
