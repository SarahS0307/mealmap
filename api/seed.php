<?php
/**
 * Beispieldaten für die lokale Entwicklung.
 *
 * Bewusst getrennt von schema.sql: Das Schema baut nur die Struktur, dieses
 * Skript füllt sie. Dadurch startet die Live-Instanz automatisch leer.
 *
 * Aufruf: npm run db:seed
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Nur über die Kommandozeile ausführbar.\n");
}

require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/ingredients.php';

function id(): string
{
    return bin2hex(random_bytes(16));
}

$user = query_one('SELECT id FROM users WHERE name = ?', ['Sarah']);
if (!$user) {
    $userId = id();
    execute('INSERT INTO users (id, name) VALUES (?, ?)', [$userId, 'Sarah']);
} else {
    $userId = $user['id'];
}

$kategorien = [];
foreach (['Meal Prep', 'Schnell', 'Vegetarisch'] as $name) {
    $vorhanden = query_one('SELECT id FROM categories WHERE user_id = ? AND name = ?', [$userId, $name]);
    if ($vorhanden) {
        $kategorien[$name] = $vorhanden['id'];
        continue;
    }
    $catId = id();
    execute('INSERT INTO categories (id, user_id, name) VALUES (?, ?, ?)', [$catId, $userId, $name]);
    $kategorien[$name] = $catId;
}

$titel = 'Quinoasalat mit Edamame';
$vorhanden = query_one('SELECT id FROM recipes WHERE user_id = ? AND title = ?', [$userId, $titel]);

if (!$vorhanden) {
    $recipeId = id();
    execute(
        'INSERT INTO recipes (id, user_id, title, notes, rating, freezable, servings, prep_minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [$recipeId, $userId, $titel, 'Hält sich gekühlt gut drei Tage – ideal zum Vorkochen.', 5, 0, 4, 25],
    );

    $zutaten = [
        ['Quinoa', 200, 'g'],
        ['Salatgurke', 1, 'Stück'],
        ['Frühlingszwiebeln', 3, 'Stück'],
        ['Mais', 200, 'g'],
        ['Edamame', 150, 'g'],
    ];
    foreach ($zutaten as $i => [$name, $menge, $einheit]) {
        execute(
            'INSERT INTO ingredients (id, recipe_id, name, name_key, amount, unit, position)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id(), $recipeId, $name, zutaten_schluessel($name), $menge, $einheit, $i],
        );
    }

    $schritte = [
        ['Quinoa kochen', 'Quinoa gründlich abspülen und in der doppelten Menge Wasser garen.', 900],
        ['Gemüse vorbereiten', 'Gurke würfeln, Frühlingszwiebeln in feine Ringe schneiden.', null],
        ['Mischen', 'Alles mit Mais und Edamame vermengen und abschmecken.', null],
    ];
    foreach ($schritte as $i => [$stitel, $inhalt, $timer]) {
        execute(
            'INSERT INTO steps (id, recipe_id, position, title, content, timer_seconds) VALUES (?, ?, ?, ?, ?, ?)',
            [id(), $recipeId, $i, $stitel, $inhalt, $timer],
        );
    }

    foreach (['Meal Prep', 'Vegetarisch'] as $name) {
        execute('INSERT INTO recipe_categories (recipe_id, category_id) VALUES (?, ?)', [$recipeId, $kategorien[$name]]);
    }
}

$anzahl = query_one('SELECT COUNT(*) AS n FROM recipes WHERE user_id = ?', [$userId])['n'];
// ---------------------------------------------------------------------------
// Läden für die Einkaufsliste. Optional, aber ohne Beispiel sieht man die
// Zuordnung auf der Liste gar nicht.
// ---------------------------------------------------------------------------
$laeden = 0;
foreach (['Aldi', 'Edeka', 'Wochenmarkt'] as $i => $name) {
    $da = query_one('SELECT id FROM stores WHERE user_id = ? AND name = ?', [$userId, $name]);
    if ($da) {
        continue;
    }
    execute(
        'INSERT INTO stores (id, user_id, name, position) VALUES (?, ?, ?, ?)',
        [id(), $userId, $name, $i],
    );
    $laeden++;
}

// ---------------------------------------------------------------------------
// Vorrat. Zeigt die drei Verderblichkeitsstufen und ein abgelaufenes Datum,
// damit die Kennzeichnung auf der Vorratsseite überhaupt zu sehen ist.
// ---------------------------------------------------------------------------
$vorrat = 0;
$vorratsbeispiele = [
    ['Hackfleisch', 1, 'Packung', 'Kühlschrank', '+1 day'],
    ['Kopfsalat', 1, 'Stück', 'Kühlschrank', '+2 days'],
    ['Basmatireis', 500, 'g', 'Vorratsschrank', null],
    ['Gemüsebrühe', 3, 'Portion', 'Gefrierschrank', '+120 days'],
];
foreach ($vorratsbeispiele as [$name, $menge, $einheit, $ort, $haltbar]) {
    $da = query_one(
        'SELECT id FROM stock_items WHERE user_id = ? AND name = ?',
        [$userId, $name],
    );
    if ($da) {
        continue;
    }
    execute(
        'INSERT INTO stock_items
            (id, user_id, name, name_key, quantity, unit, location, best_before)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
            id(), $userId, $name, zutaten_schluessel($name), $menge, $einheit, $ort,
            $haltbar === null ? null : date('Y-m-d', strtotime($haltbar)),
        ],
    );
    $vorrat++;
}

// ---------------------------------------------------------------------------
// Plan: ein bestätigter Eintrag heute und einer übermorgen, damit sich die
// Einkaufsliste daraus erzeugen lässt und der Kalender nicht leer ist.
// ---------------------------------------------------------------------------
$planEintraege = 0;
if (isset($recipeId) || ($ersteId = query_one('SELECT id FROM recipes WHERE user_id = ? ORDER BY title LIMIT 1', [$userId])['id'] ?? null)) {
    $rezeptFuerPlan = $recipeId ?? $ersteId;

    foreach ([['today', 'dinner', 2], ['+2 days', 'lunch', 4]] as [$wann, $slot, $portionen]) {
        $datum = date('Y-m-d', strtotime($wann));
        $da = query_one(
            'SELECT id FROM plan_entries WHERE user_id = ? AND eat_date = ? AND meal_slot = ?',
            [$userId, $datum, $slot],
        );
        if ($da) {
            continue;
        }

        $tag = query_one('SELECT id FROM plan_days WHERE user_id = ? AND date = ?', [$userId, $datum]);
        if (!$tag) {
            $tagId = id();
            execute('INSERT INTO plan_days (id, user_id, date) VALUES (?, ?, ?)', [$tagId, $userId, $datum]);
        } else {
            $tagId = $tag['id'];
        }

        execute(
            'INSERT INTO plan_entries
                (id, user_id, plan_day_id, cook_date, eat_date, meal_slot, recipe_id,
                 portion_count, for_whom, guest_count, status, is_absent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                id(), $userId, $tagId, $datum, $datum, $slot, $rezeptFuerPlan,
                $portionen, json_encode(['Ich'], JSON_UNESCAPED_UNICODE), 0, 'confirmed', 0,
            ],
        );
        $planEintraege++;
    }
}

// ---------------------------------------------------------------------------
// Einkaufsliste: zwei Posten von Hand, damit die Seite nicht leer startet.
// Der Rest entsteht über "Aus dem Plan übernehmen".
// ---------------------------------------------------------------------------
$listenposten = 0;
$ersterLaden = query_one('SELECT id FROM stores WHERE user_id = ? ORDER BY position LIMIT 1', [$userId]);
foreach ([['Spülmittel', 1, 'Flasche', 'household'], ['Kaffeebohnen', 500, 'g', 'drinks']] as [$name, $menge, $einheit, $bereich]) {
    $da = query_one(
        "SELECT id FROM shopping_list_items WHERE user_id = ? AND name = ?",
        [$userId, $name],
    );
    if ($da) {
        continue;
    }
    execute(
        'INSERT INTO shopping_list_items
            (id, user_id, name, name_key, quantity, unit, store_category,
             source_type, status, store_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            id(), $userId, $name, zutaten_schluessel($name), $menge, $einheit,
            $bereich, 'manual', 'open', $ersterLaden['id'] ?? null,
        ],
    );
    $listenposten++;
}

echo "Beispieldaten für \"Sarah\" angelegt.\n";
echo "  Rezepte: $anzahl · Läden: $laeden · Vorrat: $vorrat · Plan: $planEintraege · Einkaufsliste: $listenposten\n";
