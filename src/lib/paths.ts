/**
 * Pfade zu Dateien aus dem Ordner /public.
 *
 * Next.js setzt `basePath` bei Verweisen über `next/link` und bei den Icons aus
 * dem App-Ordner automatisch davor. Bei `next/image` mit abgeschalteter
 * Bildoptimierung passiert das **nicht** – dort bleibt der Pfad so stehen, wie er
 * im Code notiert ist. Lokal liegt die App aber im Unterordner /MealMap, live an
 * der Wurzel. Deshalb jede Datei aus /public über diese Funktion ansprechen.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(pfad: string): string {
  return `${BASE}${pfad.startsWith("/") ? pfad : `/${pfad}`}`;
}
