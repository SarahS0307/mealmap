/**
 * Baut den Ordner, der genauso aussieht wie später auf dem Live-Server:
 *
 *   dist/           die gebaute Oberfläche (aus out/)
 *   dist/api/       die PHP-API
 *
 * Damit lässt sich lokal unter einer einzigen Adresse arbeiten – ohne zweiten
 * Port, ohne CORS, mit relativem /api. Genau wie auf Strato.
 *
 *   npm run preview   erzeugt dist/ inklusive der lokalen Zugangsdaten
 *   npm run bundle    erzeugt dist/ ohne Zugangsdaten, zum Hochladen
 */
import { cp, mkdir, rm, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const mitZugangsdaten = process.argv.includes("--with-config");
// Verzeichnis, unter dem die App später erreichbar ist. Live leer, lokal /MealMap.
const basis =
  process.argv.find((a) => a.startsWith("--base="))?.slice("--base=".length) ?? "";

async function existiert(pfad) {
  try {
    await access(pfad);
    return true;
  } catch {
    return false;
  }
}

if (!(await existiert(path.join(root, "out")))) {
  console.error("out/ fehlt. Erst bauen: npm run build");
  process.exit(1);
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

// 1. Gebaute Oberfläche ins Wurzelverzeichnis
await cp(path.join(root, "out"), dist, { recursive: true });

// 2. API daneben – ohne die lokalen Zugangsdaten
await cp(path.join(root, "api"), path.join(dist, "api"), {
  recursive: true,
  filter: (quelle) => !quelle.endsWith("/config.php"),
});

// 3. Zugangsdaten nur für die lokale Vorschau mitnehmen
const config = path.join(root, "api", "config.php");
if (mitZugangsdaten && (await existiert(config))) {
  await cp(config, path.join(dist, "api", "config.php"));
}

// 4. Serverregeln für das Wurzelverzeichnis
await writeFile(
  path.join(dist, ".htaccess"),
  `# Erzeugt von scripts/bundle.mjs – nicht von Hand ändern.

Options -Indexes

# index.php muss mit drin stehen, sonst findet Apache den Einstiegspunkt der API nicht.
DirectoryIndex index.html index.php

# Eigene Fehlerseite statt der von Apache
ErrorDocument 404 ${basis}/404.html
`,
  "utf8",
);

const hinweis = mitZugangsdaten
  ? "Enthält api/config.php mit den lokalen Zugangsdaten – nur für die Vorschau."
  : "Ohne api/config.php. Auf dem Server aus config.example.php anlegen.";

console.log(`dist/ erzeugt. ${hinweis}`);
