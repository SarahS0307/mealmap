<?php
/** Kategorien: anlegen, umbenennen, löschen. */

function route_categories_index(): never
{
    $user = require_user();
    $rows = query(
        'SELECT c.id, c.name, COUNT(rc.recipe_id) AS recipe_count
           FROM categories c
           LEFT JOIN recipe_categories rc ON rc.category_id = c.id
          WHERE c.user_id = ?
          GROUP BY c.id, c.name
          ORDER BY c.name ASC',
        [$user['id']],
    );

    send_json([
        'categories' => array_map(
            static fn(array $r): array => [
                'id'          => $r['id'],
                'name'        => $r['name'],
                'recipeCount' => (int) $r['recipe_count'],
            ],
            $rows,
        ),
    ]);
}

function route_categories_create(): never
{
    $user = require_user();
    $name = body_string('name', 60);

    if ($name === '') {
        fail('Bitte gib einen Namen ein.');
    }

    $vorhanden = query_one(
        'SELECT id FROM categories WHERE user_id = ? AND name = ?',
        [$user['id'], $name],
    );
    if ($vorhanden) {
        fail('Diese Kategorie gibt es schon.', 409);
    }

    $id = new_id();
    execute('INSERT INTO categories (id, user_id, name) VALUES (?, ?, ?)', [$id, $user['id'], $name]);
    send_json(['category' => ['id' => $id, 'name' => $name, 'recipeCount' => 0]], 201);
}

function route_categories_update(string $id): never
{
    $user = require_user();
    $name = body_string('name', 60);

    if ($name === '') {
        fail('Bitte gib einen Namen ein.');
    }

    $eigene = query_one('SELECT id FROM categories WHERE id = ? AND user_id = ?', [$id, $user['id']]);
    if (!$eigene) {
        fail('Diese Kategorie gibt es nicht.', 404);
    }

    $belegt = query_one(
        'SELECT id FROM categories WHERE user_id = ? AND name = ? AND id <> ?',
        [$user['id'], $name, $id],
    );
    if ($belegt) {
        fail('Eine Kategorie mit diesem Namen gibt es schon.', 409);
    }

    execute('UPDATE categories SET name = ? WHERE id = ?', [$name, $id]);
    send_json(['category' => ['id' => $id, 'name' => $name]]);
}

/**
 * Löscht eine Kategorie. Enthält sie Rezepte, verlangt das Konzept eine
 * Rückfrage: Sollen die Rezepte vorher einer anderen Kategorie zugewiesen
 * werden? Deshalb bricht der Aufruf ohne Angabe mit 409 ab und meldet, wie
 * viele Rezepte betroffen sind – die Oberfläche kann dann nachfragen.
 *
 * moveToCategoryId: Rezepte dorthin umhängen
 * force: Rezepte ohne Ersatz aus der Kategorie nehmen
 */
function route_categories_delete(string $id): never
{
    $user = require_user();

    $kategorie = query_one('SELECT id, name FROM categories WHERE id = ? AND user_id = ?', [$id, $user['id']]);
    if (!$kategorie) {
        fail('Diese Kategorie gibt es nicht.', 404);
    }

    $anzahl = (int) query_one(
        'SELECT COUNT(*) AS n FROM recipe_categories WHERE category_id = ?',
        [$id],
    )['n'];

    $ziel = body_string('moveToCategoryId', 64);
    $force = (bool) (body()['force'] ?? false);

    if ($anzahl > 0 && $ziel === '' && !$force) {
        send_json([
            'needsDecision' => true,
            'recipeCount'   => $anzahl,
            'message'       => "In dieser Kategorie liegen $anzahl Rezepte.",
        ], 409);
    }

    if ($anzahl > 0 && $ziel !== '') {
        $zielKategorie = query_one(
            'SELECT id FROM categories WHERE id = ? AND user_id = ?',
            [$ziel, $user['id']],
        );
        if (!$zielKategorie) {
            fail('Die gewählte Zielkategorie gibt es nicht.', 404);
        }

        // Rezepte umhängen. IGNORE, weil ein Rezept schon in der Zielkategorie
        // liegen kann – dann bleibt es dort einfach.
        execute(
            'INSERT IGNORE INTO recipe_categories (recipe_id, category_id)
             SELECT recipe_id, ? FROM recipe_categories WHERE category_id = ?',
            [$ziel, $id],
        );
    }

    // Die Verknüpfungen verschwinden über den Fremdschlüssel mit.
    execute('DELETE FROM categories WHERE id = ?', [$id]);
    send_json(['deleted' => true, 'movedRecipes' => $ziel !== '' ? $anzahl : 0]);
}
