import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Einkaufsliste – MealMap" };

export default function EinkaufslistePage() {
  return (
    <ModulePlaceholder
      title="Einkaufsliste"
      description="Entsteht automatisch aus deinem Plan, ergänzbar um eigene Posten."
      phase="Phase 6 und 7"
      upcoming={[
        "Zutaten aus bestätigten Plan-Einträgen werden automatisch übernommen",
        "Gleiche Zutaten aus mehreren Rezepten werden zusammengefasst",
        "Später: Abgleich mit dem Vorrat und Gruppierung nach Supermarktbereichen",
        "Später: Hinweise auf einen zweiten Einkaufstermin bei frischer Ware",
      ]}
    />
  );
}
