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
| Hochgeladene Dateien | Bilder und PDFs | `uploads/` |

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
npm run watch
```

Der Ordner `uploads/` muss beschreibbar sein – dort landen Bilder und PDFs.

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

`npm run watch` beobachtet `src/`, `api/` und `public/`, baut das Bündel bei jeder
Änderung neu (etwa 8 Sekunden) und **lädt die Seite im Browser automatisch nach**.

BrowserSync läuft dabei als reiner Meldedienst auf Port 3001: Ausgeliefert wird
weiterhin von Apache, die Seite lädt nur ein kleines Skript nach und horcht
darauf, ob neu gebaut wurde. Die gewohnte Adresse bleibt dadurch unverändert.

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
| `npm run watch` | Beobachtet die Quelldateien, baut neu und lädt die Seite automatisch nach – der normale Weg beim Arbeiten |
| `npm run clean` | Löscht `.next` und `out`. Läuft vor jedem Bau automatisch mit |
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
api/upgrades.php  nachträgliche Schemaänderungen für bestehende Datenbanken
api/lib/plan.php  Prüfungen und Hilfen für den Meal-Prep-Plan
src/lib/dates.ts  Datumsrechnung ohne UTC-Fallstricke
api/lib/suggest.php  Vorschlagsmotor für den Plan
api/lib/feiertage.php  Feiertage je Bundesland, einzige Quelle
api/lib/stock.php  Vorrat: zubuchen, abbuchen, an Mahlzeiten hängen
uploads/          hochgeladene Bilder und PDFs – niemals mitlöschen
dist/             erzeugtes Bündel: gebaute Oberfläche + api/, so wie es live liegt
assets/           Quelldateien für Logo und Icons
docs/             Dossier und Moodboard
scripts/          Hilfsskripte
```

Farben und Schriften liegen als Design-Tokens in `src/app/globals.css`. shadcn/ui
setzt darauf auf, jede neue Komponente erbt die Palette also automatisch.

## Der Plan hat zwei Ansichten

Beide zeigen dieselben Daten, nur unterschiedlich dicht:

- **Kalender** – der ganze Monat als Raster, darin nur die Beschriftungen
  („Frühstück geplant“, „Mittagessen vorgeschlagen“, „Mittag nicht da“).
  Startansicht, für den Überblick. Ein Klick auf einen Tag wechselt in die
  Tagesansicht bei genau diesem Tag.
- **Tage** – eine Woche ausführlich, zum Bearbeiten: Einträge anlegen, Portionen
  ändern, Gekocht- und Gegessen-Haken setzen, Einkaufstag markieren.

Der Kalender ist aufgebaut wie der auf dem Telefon: das Raster passt sich immer
der Breite an, darunter steht die Liste des gewählten Tages. Auf schmalen
Displays zeigen die Zellen nur farbige Punkte – die Beschriftungen im Klartext
stehen dann in der Liste darunter.

**Wochen beginnen immer montags**, in beiden Ansichten.

Der Code liegt in [src/app/plan/page.tsx](src/app/plan/page.tsx) (Umschaltung und
Tagesansicht) und [src/components/plan-calendar.tsx](src/components/plan-calendar.tsx)
(Monatsraster). Die Datumsrechnung steckt vollständig in
[src/lib/dates.ts](src/lib/dates.ts) – dort wird bewusst nie `new Date("JJJJ-MM-TT")`
benutzt, weil das als UTC gelesen wird und den Tag um eins verschieben kann.

## Rezepte vorschlagen

„Woche vorschlagen“ in der Tagesansicht füllt die freien Slots der angezeigten
Woche. Der Motor steht in [api/lib/suggest.php](api/lib/suggest.php) und läuft
in zwei Betriebsarten.

**Reste zuerst** gilt in beiden Betriebsarten: Was im Vorrat liegt, wird vor
neuem Kochen verplant – davon zuerst, was am ehesten abläuft. Schon verplante
Portionen zählen mit, damit derselbe Rest nicht zweimal eingeplant wird;
abgebucht wird aber erst beim Gegessen-Haken.

**Ohne hinterlegte Gewohnheiten** – eine schlichte Rotation: freie Mittag- und
Abendslots bekommen etwas, gekocht wird am selben Tag. Ausgewählt wird,
was nie oder am längsten nicht geplant war; bei Gleichstand entscheidet die
Bewertung. Mittags und abends landet nie dasselbe Gericht. Bewusst **ohne
Annahmen** darüber, wann jemand auswärts isst oder frühstückt.

**Mit Gewohnheiten und API-Schlüssel** – die KI liest den Freitext aus den
Einstellungen (siehe unten) und verteilt die Mahlzeiten danach. Sie darf alle
sechs Slots belegen, welche freilassen, Abwesenheiten setzen und Kochtermine
vorziehen. Mitgegeben werden ihr nur Tatsachen: Wochentag, Feiertag, der letzte
Sonntag als mögliches Kochdatum, was im Vorrat liegt (`inStock`) und wo schon
Abwesenheit eingetragen ist (`absences`) – letzteres auch für die **Folgewoche**,
damit sie vor blockierten Tagen größere Portionen einplanen kann. Wer ein
Wochenende weg ist, kocht dann nicht und braucht vorher etwas im Gefrierschrank.

Die schlichte Rotation kann das nicht: Sie kocht am selben Tag und kennt keinen
Kochrhythmus – wann jemand vorkocht, ist eine Gewohnheit und steht bewusst
nicht im Code.

Die Antwort der KI wird **geprüft, nicht geglaubt** – `vorschlag_antwort_pruefen()`
wirft weg, was nicht passt: erfundene Rezepte, Slots die nicht frei waren, Tage
außerhalb der Woche, doppelt belegte Slots. Ein Kochtermin nach dem Essenstermin
wird zurechtgerückt, absurde Portionszahlen auf 1 gesetzt.

Der zweite Weg **kostet Geld** über den hinterlegten Schlüssel. Der Knopf sagt
das: er heißt dann „Woche vorschlagen (KI)“ und der Text daneben nennt die
Kosten.

In beiden Fällen gilt: nur leere Slots werden gefüllt, auch wenn man den
Vorschlag mehrfach startet. Alles entsteht als **Vorschlag** und muss
übernommen werden; „Vorschläge verwerfen“ räumt eine Woche wieder frei und
lässt Bestätigtes stehen.

## Gewohnheiten stehen nicht im Code

Wann jemand auswärts isst, ob er zuhause frühstückt, welcher Kochrhythmus passt
– das ist bei jeder Person anders und steht deshalb **nirgends im Code**. Es
liegt als Freitext an `users.habits` und ist in den Einstellungen änderbar.

Die Trennlinie:

| | gehört in den Code | gehört in den Freitext |
| --- | --- | --- |
| Wochentage, gesetzliche Feiertage | ja | – |
| Ladenschluss an Sonn- und Feiertagen | ja | – |
| „mittags im Geschäft“, „kein Frühstück zuhause“ | **nein** | ja |
| „sonntags vorkochen“, „freitags bestelle ich“ | **nein** | ja |

Tatsachen gelten für alle, Gewohnheiten für genau eine Person. Liegt kein
Gewohnheitstext vor, verhält sich die App neutral, statt etwas anzunehmen.

## Der Vorrat

Eine eigene Hauptseite unter `/vorrat`, neben Rezepte, Plan und Einkaufsliste.
Gezählt wird in **Portionen** – so wird es angegeben: „vier Portionen Reis
eingefroren". Andere Einheiten sind erlaubt (für den Vorratsschrank später),
die Portion ist die Vorgabe.

Wie der Bestand sich ändert:

| Auslöser | Wirkung |
| --- | --- |
| „einfrieren" an einem gekochten Plan-Eintrag | Portionen kommen dazu |
| Mahlzeit aus dem Vorrat als **gegessen** abhaken | Portionen gehen ab |
| denselben Haken zurücknehmen | Portionen kommen zurück |
| +/− und „anlegen" auf der Vorratsseite | von Hand, jederzeit |

Gleichartige Posten werden zusammengefasst – gleicher vereinheitlichter Name,
gleiche Einheit, gleicher Ort, gleiches Datum ergibt eine Zeile mit der Summe.
Ein Posten, der auf 0 fällt, verschwindet.

**Eine Mahlzeit kann aus mehreren Vorratsposten bestehen**, ohne dass ein
Rezept dahintersteht: „1 Portion Reis, 1 Portion Hackfleisch, 1 Portion
Salsasoße". Dafür gibt es [plan_entry_stock](api/schema.sql); `recipe_id` am
Eintrag bleibt daneben bestehen, beides zusammen ist erlaubt.

`plan_entry_stock.consumed_at` merkt sich, was schon abgebucht wurde – sonst
würde zweimaliges Abhaken doppelt buchen. Die Plan-Liste lädt die Zuordnung
für den ganzen Zeitraum in **einer** Abfrage, nicht je Eintrag: bei einem Monat
mit sechs Slots am Tag wären das sonst schnell hundertachtzig.

**Mengen werden beim Kochen skaliert:** An jedem Plan-Eintrag mit Rezept führt
„kochen" in den Kochmodus, und zwar mit der **geplanten** Portionszahl statt
der Vorgabe des Rezepts (`/rezepte/kochen/?id=…&portionen=…`). Gerundet wird
auf Abmessbares – aus 133,33 g werden 135 g, halbe Zahlen erscheinen als ½,
siehe [src/lib/portions.ts](src/lib/portions.ts).

Code: [api/lib/stock.php](api/lib/stock.php),
[api/routes/stock.php](api/routes/stock.php),
[src/app/vorrat/page.tsx](src/app/vorrat/page.tsx).

## Für wen gekocht wird

Ein Plan-Eintrag trennt zwei Dinge:

- `forWhom` – **namentlich** genannte Mitesser, als Liste (Vorgabe `["Ich"]`).
- `guestCount` – **weitere Personen ohne Namen**, etwa Besuch. Eine Zahl, keine
  Liste.

Die Trennung ist Absicht: Sobald es Haushalte gibt (siehe Dossier, Ideenliste),
wird aus dem Namensfeld eine Auswahl der Haushaltsmitglieder, während die Zahl
für alle übrigen stehen bleibt. Wer mitisst, ist damit auch dann zählbar, wenn
er keinen Namen hat – das braucht später die Mengenskalierung.

## Feiertage

Welche Feiertage gelten, hängt am Bundesland. Es steht an `users.state`,
Vorgabe `BW`, und ist in den Einstellungen änderbar.

Die Tabelle liegt **nur** in [api/lib/feiertage.php](api/lib/feiertage.php) –
alle sechzehn Länder, die beweglichen Feiertage über die Gaußsche Osterformel.
`easter_date()` aus PHP wäre kürzer, setzt aber die Kalender-Erweiterung
voraus, auf die bei Strato kein Verlass ist.

Das Frontend rechnet nichts davon nach: `GET /plan` liefert je Tag den Namen
des Feiertags mit (`holiday`, sonst `null`). Eine zweite Fassung in TypeScript
würde früher oder später auseinanderlaufen.

Daraus folgen zwei Regeln:

- **Einkaufen:** sonntags gar nicht – die API weist es ab. An Feiertagen fragt
  sie nach (`409` mit `needsDecision: "feiertag"`) und setzt es erst mit
  `trotzFeiertag`; „teilweise eingeschränkt“ ist eben kein Verbot.
- **Mittagessen:** nur an echten Arbeitstagen wird vorgekocht. Am Wochenende
  und an Feiertagen ist Sarah daheim, da wird am selben Tag gekocht.

Nicht abgebildet sind Feiertage, die nur einzelne Gemeinden betreffen
(Augsburger Friedensfest, Mariä Himmelfahrt in Bayern) – die hängen am Ort,
nicht am Bundesland.

## KI-Import

Rezepte lassen sich aus Text, einem Link, einem Foto oder einem PDF übernehmen.
Dafür braucht es einen API-Schlüssel, den jede Nutzerin in den Einstellungen
hinterlegt. **Ohne Schlüssel funktioniert die App vollständig weiter** – dann
werden Rezepte von Hand eingegeben, und der Import sagt das auch.

Der Aufruf geht über rohes HTTP (`api/lib/claude.php`, Modell `claude-opus-5`),
nicht über das PHP-SDK: Das Projekt hat bewusst keine Composer-Abhängigkeiten,
damit auf den Server nur Dateien hochgeladen werden müssen.

Eine Quelle kann mehrere Rezepte enthalten. Sie werden einzeln zur Bestätigung
vorgelegt; gespeichert wird nur, was angehakt bleibt.

## Sicherheit

Der Schlüssel für den KI-Import wird ausschließlich serverseitig gespeichert und
niemals an den Browser zurückgegeben – die API meldet nur, *ob* einer hinterlegt
ist.

Bei Uploads wird der **Dateiinhalt** geprüft, nicht die Endung, und der Dateiname
neu vergeben. Erlaubt sind JPEG, PNG, WebP, HEIC und PDF bis 12 MB.

Vor dem Livegang stehen zwei Punkte an, die im Dossier vermerkt sind: nur
hinterlegte Namen zulassen und der Zugriffsschutz.

## Beim Hochladen auf den Server

`npm run bundle` erzeugt `dist/` ohne Zugangsdaten. Auf dem Server zusätzlich:

- `api/config.php` aus `config.example.php` anlegen und ausfüllen
- `api/schema.sql` über phpMyAdmin einspielen
- einen ersten Nutzer in die Tabelle `users` eintragen
- **`uploads/` niemals mitlöschen** – dort liegen alle Bilder und PDFs
