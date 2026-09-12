"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  system: "Wie das Gerät",
  light: "Hell",
  dark: "Dunkel",
};

const STORAGE_KEY = "mealmap-theme";

type ThemeValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

function istTheme(wert: unknown): wert is Theme {
  return typeof wert === "string" && (THEMES as readonly string[]).includes(wert);
}

/**
 * Setzt die Klassen, auf die das Farbschema in globals.css hört.
 *
 * Bei "system" wird keine Klasse gesetzt – dann greift die Regel
 * `prefers-color-scheme`, die App folgt also der Geräteeinstellung. "light" und
 * "dark" setzen die entsprechende Klasse und übersteuern das Gerät.
 */
function anwenden(theme: Theme) {
  const wurzel = document.documentElement;
  wurzel.classList.remove("light", "dark");
  if (theme !== "system") {
    wurzel.classList.add(theme);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");

  // Gespeicherte Wahl übernehmen. Die Einstellung gehört zum Gerät, nicht zum
  // Nutzerkonto – deshalb im Browser gespeichert und nicht in der Datenbank.
  useEffect(() => {
    let gespeichert: string | null = null;
    try {
      gespeichert = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Privater Modus oder blockierte Speicherung: dann eben "system".
    }
    if (istTheme(gespeichert)) {
      setThemeState(gespeichert);
      anwenden(gespeichert);
    }
  }, []);

  const setTheme = useCallback((neu: Theme) => {
    setThemeState(neu);
    anwenden(neu);
    try {
      window.localStorage.setItem(STORAGE_KEY, neu);
    } catch {
      // Nicht speicherbar – die Wahl gilt dann nur für diese Sitzung.
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const wert = useContext(ThemeContext);
  if (!wert) {
    throw new Error("useTheme benötigt einen ThemeProvider.");
  }
  return wert;
}
