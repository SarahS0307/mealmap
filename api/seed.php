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
echo "Beispieldaten für \"Sarah\" angelegt. Rezepte: $anzahl\n";
