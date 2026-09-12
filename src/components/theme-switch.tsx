"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { THEMES, THEME_LABELS, useTheme, type Theme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const ICONS: Record<Theme, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label="Farbschema"
        className="inline-flex rounded-lg border border-border p-1"
      >
        {THEMES.map((wert) => {
          const Icon = ICONS[wert];
          const aktiv = theme === wert;
          return (
            <button
              key={wert}
              type="button"
              role="radio"
              aria-checked={aktiv}
              onClick={() => setTheme(wert)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                aktiv
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {THEME_LABELS[wert]}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        „Wie das Gerät“ übernimmt die Einstellung deines Systems und wechselt
        automatisch mit, etwa abends. Die Wahl gilt für diesen Browser, nicht
        für dein Konto – am Handy kannst du also etwas anderes einstellen.
      </p>
    </div>
  );
}
