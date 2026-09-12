# MealMap

Rezepte, Meal-Prep-Plan und Einkaufsliste in einer Webapp.

Konzept, Arbeitsplan und alle Entscheidungen stehen im Dossier: [docs/dossier.html](docs/dossier.html).
Die gestalterische Grundlage liegt daneben im [Moodboard](docs/moodboard.html).

## Wie das Projekt aufgebaut ist

Zielumgebung ist **Strato Hosting Starter** – klassischer Webspace mit PHP und
MySQL, aber ohne Node. Daraus ergibt sich die Zweiteilung:

| Teil | Technik | Wo es liegt |
| --- | --- | --- |
| Oberfläche | Next.js, gebaut als **statischer Export** (reines HTML/CSS/JS) | `src/`, gebaut nach `out/` |
| Daten | **PHP-API** mit PDO, **MySQL** | `api/` |

Die Oberfläche spricht ausschließlich über `src/lib/api.ts` mit der API. Es gibt
keinen Node-Server im Betrieb – der Entwicklungsserver von Next.js dient nur dem
bequemen Arbeiten.

## Auf einem neuen Rechner einrichten

Voraussetzung: MAMP (oder ein anderer Apache mit PHP 8 und MySQL) läuft, und es
gibt eine leere Datenbank namens `mealmap`.

```bash
npm install
cp api/config.example.php api/config.php
npm run db:migrate
npm run db:seed
npm run preview
```

`api/config.php` wird nicht eingecheckt, weil die Datei Zugangsdaten enthält –
daneben liegt `config.example.php` als Vorlage.

**Wichtig:** Lokal liegt die App im Unterordner `/MealMap`, live an der Wurzel
der Subdomain. Deshalb setzen die Skripte `basePath` unterschiedlich – `preview`
auf `/MealMap`, `bundle` auf leer. Baue den Server-Ordner deshalb immer mit
`npm run bundle`, nie mit `npm run preview`.

Zwei Voraussetzungen in der Apache-Konfiguration:

1. **`mod_rewrite` muss aktiviert sein**, sonst antworten die API-Pfade mit 404.
2. Das Stammverzeichnis muss `~/Sites` sein, damit `localhost:8888/MealMap/`
   auf den Projektordner zeigt. Die `.htaccess` dort leitet auf `dist/` um und
   sperrt zugleich den Quellcode.

## Zwei Arten zu arbeiten

**So, wie es später live läuft** – alles über Apache unter einer einzigen
Adresse, `/api` relativ, kein CORS. Das ist der normale Weg:

```bash
npm run watch
```

Danach: **http://localhost:8888/MealMap/**

`npm run watch` beobachtet `src/`, `api/` und `public/` und baut das Bündel bei
jeder Änderung neu (etwa 6 Sekunden). Die Seite im Browser danach einmal neu
laden – automatisches Nachladen ginge nur über einen zweiten Port.

Einmalig bauen ohne Beobachten: `npm run preview`.

Der Ordner `dist/` ist zugleich das, was auf den Server hochgeladen wird.

**Schnell, mit sofortigem Nachladen** – Next.js auf Port 3000, API über MAMP auf
Port 8888. Bequemer beim Entwickeln, weicht aber vom Livebetrieb ab:

```bash
npm run dev            # http://localhost:3000
npm run sync           # zusätzlich BrowserSync und eine URL fürs Handy
```

## Befehle

| Befehl | Wozu |
| --- | --- |
| `npm run watch` | Beobachtet die Quelldateien und baut bei jeder Änderung neu – der normale Weg beim Arbeiten |
| `npm run preview` | Baut `dist/` einmalig für den Unterordner `/MealMap`, inklusive lokaler Zugangsdaten |
| `npm run bundle` | Baut `dist/` **ohne** Zugangsdaten – das ist der Ordner für den Server |
| `npm run dev` | Next.js auf Port 3000 |
| `npm run sync` | Next.js plus BrowserSync auf Port 3001 – gibt eine Netzwerk-URL fürs Handy aus und spiegelt Scrollen und Klicks über mehrere Geräte |
| `npm run build` | Statischer Export nach `out/`, prüft dabei Typen und Lint-Regeln |
| `npm run icons` | Erzeugt Logo-PNG, Favicon und Homescreen-Icon neu aus `assets/logo-mark.svg` |
| `npm run db:migrate` | Legt die Tabellen aus `api/schema.sql` in MySQL an |
| `npm run db:seed` | Füllt Beispieldaten ein |
| `npm run db:reindex` | Berechnet die Zutatenschlüssel neu – nötig nach Änderungen an `api/lib/ingredients.php` |

Den Produktions-Build nicht starten, während der Entwicklungsserver läuft – beide
schreiben nach `.next` und kommen sich in die Quere.

## Warum Next.js, wenn der Server PHP spricht

Next.js läuft **nicht auf dem Server**, sondern nur auf dem Entwicklungsrechner.
Es ist ein Werkzeug, das aus dem React-Code fertige HTML-, CSS- und
JavaScript-Dateien erzeugt. Auf Strato landet nur dieses Ergebnis plus die
PHP-API – dort ist kein Node im Spiel.

| | Aufgabe | Läuft auf dem Server |
| --- | --- | --- |
| PHP + MySQL | Daten speichern und ausliefern | ja |
| Next.js | baut die Oberfläche | nein, nur beim Entwickeln |

## Aufbau

```
src/app/          Seiten: Start, Rezepte, Plan, Einkaufsliste, Einstellungen
src/components/   Layout, Navigation, Logo, Formulare, wiederverwendbare Bausteine
src/lib/          API-Zugriff, Navigation, Wertelisten, Hilfsfunktionen
api/              PHP-API: Einstiegspunkt, Routen, Datenbank, Schema
api/schema.sql    Datenbankstruktur – live über phpMyAdmin einspielbar
dist/             erzeugtes Bündel: gebaute Oberfläche + api/, so wie es live liegt
assets/           Quelldateien für Logo und Icons
docs/             Dossier und Moodboard
scripts/          Hilfsskripte
```

Farben und Schriften liegen als Design-Tokens in `src/app/globals.css`. shadcn/ui
setzt darauf auf, jede neue Komponente erbt die Palette also automatisch.

## Sicherheit

Der Schlüssel für den KI-Import wird ausschließlich serverseitig gespeichert und
niemals an den Browser zurückgegeben – die API meldet nur, *ob* einer hinterlegt
ist. Vor dem Livegang stehen zwei weitere Punkte an, die im Dossier vermerkt sind:
nur hinterlegte Namen zulassen und der Zugriffsschutz.
