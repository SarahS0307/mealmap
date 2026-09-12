<?php
/** Rezepte: auflisten, anzeigen, anlegen, ändern, löschen. */

require_once __DIR__ . '/../lib/ingredients.php';
require_once __DIR__ . '/../lib/adjust.php';

/** Baut die vollständige Darstellung eines Rezepts inklusive Unterlisten. */
function rezept_laden(string $id, string $userId): ?array
{
    $r = query_one('SELECT * FROM recipes WHERE id = ? AND user_id = ?', [$id, $userId]);
    if (!$r) {
        return null;
    }

    $zutaten = query(
        'SELECT id, name, amount, unit FROM ingredients WHERE recipe_id = ? ORDER BY position ASC',
        [$id],
    );
    $schritte = query(
        'SELECT id, title, content, timer_seconds FROM steps WHERE recipe_id = ? ORDER BY position ASC',
        [$id],
    );
    $kategorien = query(
        'SELECT c.id, c.name FROM recipe_categories rc
           JOIN categories c ON c.id = rc.category_id
          WHERE rc.recipe_id = ? ORDER BY c.name ASC',
        [$id],
    );

    return [
        'id'          => $r['id'],
        'title'       => $r['title'],
        'notes'       => $r['notes'],
        'comment'     => $r['comment'],
        'rating'      => $r['rating'] === null ? null : (int) $r['rating'],
        'freezable'   => (bool) $r['freezable'],
        'servings'    => (int) $r['servings'],
        'prepMinutes' => $r['prep_minutes'] === null ? null : (int) $r['prep_minutes'],
        'sourceType'  => $r['source_type'],
        'sourceUrl'   => $r['source_url'],
        'createdAt'   => $r['created_at'],
        'updatedAt'   => $r['updated_at'],
        'ingredients' => array_map(
            static fn(array $z): array => [
                'id'     => $z['id'],
                'name'   => $z['name'],
                'amount' => $z['amount'] === null ? null : (float) $z['amount'],
                'unit'   => $z['unit'],
            ],
            $zutaten,
        ),
        'steps' => array_map(
            static fn(array $s): array => [
                'id'           => $s['id'],
                'title'        => $s['title'],
                'content'      => $s['content'],
                'timerSeconds' => $s['timer_seconds'] === null ? null : (int) $s['timer_seconds'],
            ],
            $schritte,
        ),
        'categories' => $kategorien,
    ];
}

function route_recipes_index(): never
{
    $user = require_user();

    // Nur die Felder, die die Liste braucht – nicht das ganze Rezept.
    $rows = query(
        'SELECT id, title, rating, freezable, servings, prep_minutes, updated_at
           FROM recipes WHERE user_id = ? ORDER BY title ASC',
        [$user['id']],
    );

    // Kategorien für alle Rezepte in einem Rutsch, statt je Rezept einzeln.
    $zuordnung = [];
    foreach (query(
        'SELECT rc.recipe_id, c.id, c.name
           FROM recipe_categories rc
           JOIN categories c ON c.id = rc.category_id
          WHERE c.user_id = ? ORDER BY c.name ASC',
        [$user['id']],
    ) as $z) {
        $zuordnung[$z['recipe_id']][] = ['id' => $z['id'], 'name' => $z['name']];
    }

    send_json([
        'recipes' => array_map(
            static fn(array $r): array => [
                'id'          => $r['id'],
                'title'       => $r['title'],
                'rating'      => $r['rating'] === null ? null : (int) $r['rating'],
                'freezable'   => (bool) $r['freezable'],
                'servings'    => (int) $r['servings'],
                'prepMinutes' => $r['prep_minutes'] === null ? null : (int) $r['prep_minutes'],
                'categories'  => $zuordnung[$r['id']] ?? [],
            ],
            $rows,
        ),
    ]);
}

function route_recipes_show(string $id): never
{
    $user = require_user();
    $rezept = rezept_laden($id, $user['id']);
    if (!$rezept) {
        fail('Dieses Rezept gibt es nicht.', 404);
    }
    send_json(['recipe' => $rezept]);
}

/** Prüft und normalisiert die Eingaben aus dem Formular. */
function rezept_eingaben(): array
{
    $b = body();
    $titel = trim((string) ($b['title'] ?? ''));

    if ($titel === '') {
        fail('Bitte gib einen Titel ein.');
    }

    $bewertung = $b['rating'] ?? null;
    if ($bewertung !== null && (!is_numeric($bewertung) || $bewertung < 1 || $bewertung > 5)) {
        fail('Die Bewertung muss zwischen 1 und 5 liegen.');
    }

    $portionen = (int) ($b['servings'] ?? 2);
    if ($portionen < 1 || $portionen > 99) {
        fail('Die Portionszahl muss zwischen 1 und 99 liegen.');
    }

    return [
        'title'       => mb_substr($titel, 0, 255),
        'notes'       => trim((string) ($b['notes'] ?? '')) ?: null,
        'comment'     => trim((string) ($b['comment'] ?? '')) ?: null,
        'rating'      => $bewertung === null ? null : (int) $bewertung,
        'freezable'   => !empty($b['freezable']) ? 1 : 0,
        'servings'    => $portionen,
        'prepMinutes' => isset($b['prepMinutes']) && $b['prepMinutes'] !== '' ? (int) $b['prepMinutes'] : null,
        'ingredients' => is_array($b['ingredients'] ?? null) ? $b['ingredients'] : [],
        'steps'       => is_array($b['steps'] ?? null) ? $b['steps'] : [],
        'categoryIds' => is_array($b['categoryIds'] ?? null) ? $b['categoryIds'] : [],
    ];
}

/** Schreibt Zutaten, Schritte und Kategorien neu – einfacher als Einzelabgleich. */
function rezept_unterlisten_schreiben(string $recipeId, string $userId, array $e): void
{
    execute('DELETE FROM ingredients WHERE recipe_id = ?', [$recipeId]);
    foreach ($e['ingredients'] as $i => $z) {
        $name = trim((string) ($z['name'] ?? ''));
        if ($name === '') {
            continue;
        }
        execute(
            'INSERT INTO ingredients (id, recipe_id, name, name_key, amount, unit, position)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                new_id(),
                $recipeId,
                mb_substr($name, 0, 191),
                zutaten_schluessel($name),
                isset($z['amount']) && $z['amount'] !== '' ? (float) $z['amount'] : null,
                trim((string) ($z['unit'] ?? '')) ?: null,
                $i,
            ],
        );
    }

    execute('DELETE FROM steps WHERE recipe_id = ?', [$recipeId]);
    foreach ($e['steps'] as $i => $s) {
        $inhalt = trim((string) ($s['content'] ?? ''));
        if ($inhalt === '') {
            continue;
        }
        execute(
            'INSERT INTO steps (id, recipe_id, position, title, content, timer_seconds)
             VALUES (?, ?, ?, ?, ?, ?)',
            [
                new_id(),
                $recipeId,
                $i,
                trim((string) ($s['title'] ?? '')) ?: null,
                $inhalt,
                isset($s['timerSeconds']) && $s['timerSeconds'] !== '' ? (int) $s['timerSeconds'] : null,
            ],
        );
    }

    execute('DELETE FROM recipe_categories WHERE recipe_id = ?', [$recipeId]);
    foreach (array_unique($e['categoryIds']) as $categoryId) {
        // Nur eigene Kategorien – sonst könnte man sich an fremde anhängen.
        $eigene = query_one(
            'SELECT id FROM categories WHERE id = ? AND user_id = ?',
            [(string) $categoryId, $userId],
        );
        if ($eigene) {
            execute(
                'INSERT INTO recipe_categories (recipe_id, category_id) VALUES (?, ?)',
                [$recipeId, (string) $categoryId],
            );
        }
    }
}

function route_recipes_create(): never
{
    $user = require_user();
    $e = rezept_eingaben();
    $id = new_id();

    db()->beginTransaction();
    try {
        execute(
            'INSERT INTO recipes (id, user_id, title, notes, comment, rating, freezable, servings, prep_minutes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$id, $user['id'], $e['title'], $e['notes'], $e['comment'], $e['rating'],
             $e['freezable'], $e['servings'], $e['prepMinutes']],
        );
        rezept_unterlisten_schreiben($id, $user['id'], $e);
        db()->commit();
    } catch (Throwable $fehler) {
        db()->rollBack();
        error_log('MealMap: Rezept anlegen fehlgeschlagen: ' . $fehler->getMessage());
        fail('Das Rezept konnte nicht gespeichert werden.', 500);
    }

    send_json(['recipe' => rezept_laden($id, $user['id'])], 201);
}

function route_recipes_update(string $id): never
{
    $user = require_user();

    $vorhanden = query_one('SELECT id FROM recipes WHERE id = ? AND user_id = ?', [$id, $user['id']]);
    if (!$vorhanden) {
        fail('Dieses Rezept gibt es nicht.', 404);
    }

    $e = rezept_eingaben();

    db()->beginTransaction();
    try {
        execute(
            'UPDATE recipes SET title = ?, notes = ?, comment = ?, rating = ?,
                    freezable = ?, servings = ?, prep_minutes = ?
              WHERE id = ?',
            [$e['title'], $e['notes'], $e['comment'], $e['rating'],
             $e['freezable'], $e['servings'], $e['prepMinutes'], $id],
        );
        rezept_unterlisten_schreiben($id, $user['id'], $e);
        db()->commit();
    } catch (Throwable $fehler) {
        db()->rollBack();
        error_log('MealMap: Rezept ändern fehlgeschlagen: ' . $fehler->getMessage());
        fail('Das Rezept konnte nicht gespeichert werden.', 500);
    }

    send_json(['recipe' => rezept_laden($id, $user['id'])]);
}

/** Nur Bewertung und Kommentar ändern, ohne das ganze Rezept zu schicken. */
function route_recipes_rate(string $id): never
{
    $user = require_user();

    $vorhanden = query_one('SELECT id FROM recipes WHERE id = ? AND user_id = ?', [$id, $user['id']]);
    if (!$vorhanden) {
        fail('Dieses Rezept gibt es nicht.', 404);
    }

    $b = body();
    $bewertung = $b['rating'] ?? null;
    if ($bewertung !== null && (!is_numeric($bewertung) || $bewertung < 1 || $bewertung > 5)) {
        fail('Die Bewertung muss zwischen 1 und 5 liegen.');
    }

    execute(
        'UPDATE recipes SET rating = ?, comment = ? WHERE id = ?',
        [
            $bewertung === null ? null : (int) $bewertung,
            trim((string) ($b['comment'] ?? '')) ?: null,
            $id,
        ],
    );

    send_json(['recipe' => rezept_laden($id, $user['id'])]);
}

function route_recipes_delete(string $id): never
{
    $user = require_user();

    $vorhanden = query_one('SELECT id FROM recipes WHERE id = ? AND user_id = ?', [$id, $user['id']]);
    if (!$vorhanden) {
        fail('Dieses Rezept gibt es nicht.', 404);
    }

    // Zutaten, Schritte und Kategoriezuordnungen gehen über die Fremdschlüssel mit.
    execute('DELETE FROM recipes WHERE id = ?', [$id]);
    send_json(['deleted' => true]);
}

/**
 * Nimmt einen kurzen Änderungswunsch entgegen („2 statt 3 Eier“).
 *
 * Ohne `apply` wird nur gedeutet und zurückgemeldet, was passieren würde –
 * das Rezept bleibt unangetastet. Erst mit `apply: true` wird geschrieben.
 * So sieht Sarah vorher, was die App verstanden hat.
 */
function route_recipes_adjust(string $id): never
{
    $user = require_user();

    $rezept = rezept_laden($id, $user['id']);
    if (!$rezept) {
        fail('Dieses Rezept gibt es nicht.', 404);
    }

    $wunsch = trim((string) (body()['instruction'] ?? ''));
    if ($wunsch === '') {
        fail('Bitte beschreibe, was geändert werden soll.');
    }

    $aenderungen = aenderungen_deuten($wunsch, $rezept['ingredients']);
    $anwenden = (bool) (body()['apply'] ?? false);

    if (!$anwenden) {
        send_json(['changes' => $aenderungen, 'applied' => false]);
    }

    $verstanden = array_filter($aenderungen, static fn(array $a): bool => $a['art'] !== 'unklar');
    if ($verstanden === []) {
        fail('Davon habe ich nichts verstanden – nichts geändert.', 422);
    }

    db()->beginTransaction();
    try {
        foreach ($verstanden as $a) {
            switch ($a['art']) {
                case 'menge':
                    execute(
                        'UPDATE ingredients SET amount = ?, unit = ? WHERE id = ? AND recipe_id = ?',
                        [$a['menge'], $a['einheit'], $a['zutat']['id'], $id],
                    );
                    break;

                case 'entfernen':
                    execute(
                        'DELETE FROM ingredients WHERE id = ? AND recipe_id = ?',
                        [$a['zutat']['id'], $id],
                    );
                    break;

                case 'ersetzen':
                    execute(
                        'UPDATE ingredients SET name = ?, name_key = ? WHERE id = ? AND recipe_id = ?',
                        [
                            mb_substr($a['neuerName'], 0, 191),
                            zutaten_schluessel($a['neuerName']),
                            $a['zutat']['id'],
                            $id,
                        ],
                    );
                    break;

                case 'hinzufuegen':
                    $position = (int) (query_one(
                        'SELECT COALESCE(MAX(position), -1) + 1 AS n FROM ingredients WHERE recipe_id = ?',
                        [$id],
                    )['n']);
                    execute(
                        'INSERT INTO ingredients (id, recipe_id, name, name_key, amount, unit, position)
                         VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [
                            new_id(),
                            $id,
                            mb_substr($a['name'], 0, 191),
                            zutaten_schluessel($a['name']),
                            $a['menge'],
                            $a['einheit'],
                            $position,
                        ],
                    );
                    break;
            }
        }
        // Das Rezept selbst anfassen, damit sich updated_at bewegt.
        execute('UPDATE recipes SET title = title WHERE id = ?', [$id]);
        db()->commit();
    } catch (Throwable $fehler) {
        db()->rollBack();
        error_log('MealMap: Änderung fehlgeschlagen: ' . $fehler->getMessage());
        fail('Die Änderung konnte nicht gespeichert werden.', 500);
    }

    send_json([
        'changes'  => $aenderungen,
        'applied'  => true,
        'recipe'   => rezept_laden($id, $user['id']),
    ]);
}
