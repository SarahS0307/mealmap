"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, CalendarDays, ShoppingCart } from "lucide-react";
import { RecipeImport } from "@/components/recipe-import";
import { RecipeCard } from "@/components/recipe-card";
import { Button } from "@/components/ui/button";
import { api, type ApiRecipeSummary } from "@/lib/api";

/**
 * Startseite: hier kommen Rezepte herein.
 *
 * Die Sammlung selbst liegt weiterhin unter /rezepte – diese Seite ist die
 * Arbeitsfläche für Neuzugänge, nicht die Übersicht.
 */
export default function StartPage() {
  const [zuletzt, setZuletzt] = useState<ApiRecipeSummary[]>([]);

  useEffect(() => {
    api
      .recipes()
      .then(({ recipes }) => setZuletzt(recipes.slice(0, 2)))
      .catch(() => setZuletzt([]));
  }, []);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl">Rezept aufnehmen</h1>
          <p className="max-w-prose text-muted-foreground">
            Text einfügen, einen Link angeben oder ein Foto hochladen – MealMap
            liest Titel, Zutaten und Zubereitung heraus. Was gespeichert wird,
            entscheidest du danach.
          </p>
        </div>

        <RecipeImport />
      </section>

      {zuletzt.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading text-xl font-semibold">
              Zuletzt in der Sammlung
            </h2>
            <Button variant="ghost" size="sm" render={<Link href="/rezepte/" />}>
              Alle Rezepte
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {zuletzt.map((r) => (
              <RecipeCard key={r.id} recipe={r} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 border-t border-border pt-6 sm:grid-cols-3">
        {[
          { href: "/rezepte/", icon: BookOpen, label: "Rezepte", text: "Sammlung durchsehen und filtern" },
          { href: "/plan/", icon: CalendarDays, label: "Plan", text: "Meal-Prep-Plan Tag für Tag" },
          { href: "/einkaufsliste/", icon: ShoppingCart, label: "Einkaufsliste", text: "Entsteht aus dem Plan" },
        ].map(({ href, icon: Icon, label, text }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent"
          >
            <Icon className="size-5 text-primary" />
            <h3 className="mt-2 font-medium">{label}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
