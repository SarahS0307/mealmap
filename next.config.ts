import type { NextConfig } from "next";

/**
 * MealMap läuft auf klassischem Webspace (Strato Hosting Starter) – dort gibt
 * es kein Node. Next.js erzeugt deshalb einen rein statischen Export: HTML, CSS
 * und JavaScript, die jeder Webserver ausliefern kann. Die Daten kommen über
 * die PHP-API.
 *
 * `basePath` bestimmt, in welchem Verzeichnis die App liegt. Live ist das die
 * Wurzel der Subdomain (leer), lokal der Ordner /MealMap unter MAMP. Der Wert
 * wird beim Bauen gesetzt – siehe die Skripte `preview` und `bundle`.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  // Im Benutzerordner liegt eine fremde package-lock.json. Ohne diese Angabe
  // hielte Next den Benutzerordner für die Projektwurzel und warnt bei jedem Bau.
  outputFileTracingRoot: import.meta.dirname,
  basePath,
  // Die Bildoptimierung von Next braucht einen Node-Server, den es hier nicht gibt.
  images: { unoptimized: true },
  // Erzeugt /rezepte/index.html statt /rezepte.html – so findet Apache die
  // Seiten auch ohne zusätzliche Regeln.
  trailingSlash: true,
};

export default nextConfig;
