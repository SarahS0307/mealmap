# MealMap

Rezepte, Meal-Prep-Plan und Einkaufsliste in einer Webapp.

Konzept, Arbeitsplan und alle Entscheidungen stehen im Dossier: [docs/dossier.html](docs/dossier.html).
Die gestalterische Grundlage liegt daneben im [Moodboard](docs/moodboard.html).

## Auf einem neuen Rechner einrichten

```bash
npm install        # installiert Pakete und erzeugt den Prisma-Client
cp .env.example .env
npm run dev        # startet auf http://localhost:3000
```

Mehr braucht es nicht. `npm install` ruft über den `postinstall`-Schritt automatisch
`prisma generate` auf – der generierte Client liegt bewusst nicht im Repo, weil er
aus `prisma/schema.prisma` jederzeit neu entsteht.

Die `.env` wird nicht eingecheckt. `.env.example` ist die Vorlage dafür und enthält
keine Geheimnisse.

## Entwickeln

| Befehl | Wozu |
| --- | --- |
| `npm run dev` | Next.js auf Port 3000 |
| `npm run sync` | Next.js plus BrowserSync auf Port 3001 – gibt eine Netzwerk-URL fürs Handy aus und spiegelt Scrollen und Klicks über mehrere Geräte |
| `npm run build` | Produktions-Build, prüft dabei Typen und Lint-Regeln |
| `npm run icons` | Erzeugt Logo-PNG, Favicon und Homescreen-Icon neu aus `assets/logo-mark.svg` |
| `npm run db:migrate` | Neue Migration anlegen und anwenden |
| `npm run db:studio` | Datenbank im Browser ansehen |
| `npm run db:reset` | Lokale Datenbank zurücksetzen |

Den Produktions-Build nicht starten, während der Entwicklungsserver läuft – beide
schreiben nach `.next` und kommen sich in die Quere.

## Aufbau

```
src/app/          Seiten: Start, Rezepte, Plan, Einkaufsliste, Einstellungen
src/components/   Layout, Navigation, Logo, wiederverwendbare Bausteine
src/lib/          Navigation, Prisma-Client, Hilfsfunktionen
prisma/           Datenbankschema
assets/           Quelldateien für Logo und Icons
docs/             Dossier und Moodboard
scripts/          Hilfsskripte
```

Farben und Schriften liegen als Design-Tokens in `src/app/globals.css`. shadcn/ui
setzt darauf auf, jede neue Komponente erbt die Palette also automatisch.
