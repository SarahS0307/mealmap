import Link from "next/link";
import { navItems } from "@/lib/nav";

const teasers: Record<string, string> = {
  "/rezepte": "Sammlung mit Kategorien, Bewertungen und Kochmodus.",
  "/plan": "Meal-Prep-Plan Tag für Tag, Kochtermin getrennt vom Essenstermin.",
  "/einkaufsliste": "Entsteht automatisch aus dem Plan, abgeglichen mit dem Vorrat.",
};

export default function StartPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl">Sonntag kochen, die Woche entspannt genießen</h1>
        <p className="max-w-prose text-muted-foreground">
          Rezepte, Meal-Prep-Plan und Einkaufsliste an einem Ort. Das Grundgerüst
          steht – die Module werden Schritt für Schritt gefüllt.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent"
          >
            <item.icon className="size-5 text-primary" />
            <h2 className="mt-3 text-lg">{item.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {teasers[item.href]}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
