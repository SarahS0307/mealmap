"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { type ApiCategory, type RecipeFilter } from "@/lib/api";
import { cn } from "@/lib/utils";

const ZEITEN = [15, 30, 45, 60];
const BEWERTUNGEN = [3, 4, 5];

export function RecipeFilters({
  filter,
  kategorien,
  onChange,
  offen,
  onToggle,
}: {
  filter: RecipeFilter;
  kategorien: ApiCategory[];
  onChange: (neu: RecipeFilter) => void;
  offen: boolean;
  onToggle: () => void;
}) {
  // Wie viele Filter neben der Suche gesetzt sind – als Zahl am Knopf.
  const aktiv = [
    filter.category,
    filter.freezable,
    filter.minRating,
    filter.maxMinutes,
  ].filter((w) => w !== null && w !== undefined).length;

  function setze(teil: Partial<RecipeFilter>) {
    onChange({ ...filter, ...teil });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={filter.q ?? ""}
            onChange={(e) => setze({ q: e.target.value })}
            placeholder="Titel, Zutat oder Kategorie"
            aria-label="Rezepte durchsuchen"
            className="pl-9"
          />
        </div>
        <Button
          variant={offen || aktiv > 0 ? "default" : "outline"}
          onClick={onToggle}
          aria-expanded={offen}
        >
          <SlidersHorizontal className="size-4" />
          Filter
          {aktiv > 0 ? (
            <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 text-xs">
              {aktiv}
            </span>
          ) : null}
        </Button>
      </div>

      {offen ? (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          {kategorien.length > 0 ? (
            <Gruppe titel="Kategorie">
              {kategorien.map((k) => (
                <Knopf
                  key={k.id}
                  aktiv={filter.category === k.id}
                  onClick={() =>
                    setze({ category: filter.category === k.id ? null : k.id })
                  }
                >
                  {k.name}
                  <span className="ml-1.5 opacity-60">{k.recipeCount ?? 0}</span>
                </Knopf>
              ))}
            </Gruppe>
          ) : null}

          <Gruppe titel="Einfrierbar">
            <Knopf
              aktiv={filter.freezable === true}
              onClick={() => setze({ freezable: filter.freezable === true ? null : true })}
            >
              ja
            </Knopf>
            <Knopf
              aktiv={filter.freezable === false}
              onClick={() => setze({ freezable: filter.freezable === false ? null : false })}
            >
              nein
            </Knopf>
          </Gruppe>

          <Gruppe titel="Bewertung">
            {BEWERTUNGEN.map((b) => (
              <Knopf
                key={b}
                aktiv={filter.minRating === b}
                onClick={() => setze({ minRating: filter.minRating === b ? null : b })}
              >
                ab {b} ★
              </Knopf>
            ))}
          </Gruppe>

          <Gruppe titel="Zubereitungszeit">
            {ZEITEN.map((z) => (
              <Knopf
                key={z}
                aktiv={filter.maxMinutes === z}
                onClick={() => setze({ maxMinutes: filter.maxMinutes === z ? null : z })}
              >
                bis {z} Min
              </Knopf>
            ))}
          </Gruppe>

          {aktiv > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onChange({
                  q: filter.q,
                  category: null,
                  freezable: null,
                  minRating: null,
                  maxMinutes: null,
                })
              }
            >
              <X className="size-4" />
              Filter zurücksetzen
            </Button>
          ) : null}

          <p className="text-sm text-muted-foreground">
            Bei „bis X Minuten“ fallen Rezepte ohne Zeitangabe heraus. Die
            Zutatensuche trifft nur Wortanfänge — „Zwiebeln“ findet also keine
            Frühlingszwiebeln.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Gruppe({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {titel}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Knopf({
  aktiv,
  onClick,
  children,
}: {
  aktiv: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktiv}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        aktiv
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
