<?php
/**
 * Läden, in denen eingekauft wird – Aldi, Lidl, Edeka und so weiter.
 *
 * Rein optional: Ein Posten ohne Laden ist völlig in Ordnung. Gepflegt werden
 * sie in den Einstellungen, wie die Rezeptkategorien auch.
 */

function route_stores_index(): never
{
    $user = require_user();
    $zeilen = query(
        'SELECT id, name, position FROM stores
          WHERE user_id = ? ORDER BY position ASC, name ASC',
        [$user['id']],
    );
    send_json(['stores' => array_map(
        static fn (array $z): array => [
            'id'       => $z['id'],
            'name'     => $z['name'],
            'position' => (int) $z['position'],
        ],
        $zeilen,
    )]);
}

function laden_name(): string
{
    $name = trim((string) (body()['name'] ?? ''));
    if ($name === '') {
        fail('Bitte gib einen Namen ein.');
    }
    return mb_substr($name, 0, 191);
}

function route_stores_create(): never
{
    $user = require_user();
    $name = laden_name();

    $vorhanden = query_one(
        'SELECT id FROM stores WHERE user_id = ? AND name = ?',
        [$user['id'], $name],
    );
    if ($vorhanden) {
        fail('Diesen Laden gibt es schon.', 409);
    }

    $naechste = query_one(
        'SELECT COALESCE(MAX(position), -1) + 1 AS p FROM stores WHERE user_id = ?',
        [$user['id']],
    );

    $id = new_id();
    execute(
        'INSERT INTO stores (id, user_id, name, position) VALUES (?, ?, ?, ?)',
        [$id, $user['id'], $name, (int) $naechste['p']],
    );

    send_json(['store' => ['id' => $id, 'name' => $name, 'position' => (int) $naechste['p']]], 201);
}

function route_stores_update(string $id): never
{
    $user = require_user();
    $name = laden_name();

    $vorhanden = query_one(
        'SELECT id FROM stores WHERE id = ? AND user_id = ?',
        [$id, $user['id']],
    );
    if (!$vorhanden) {
        fail('Diesen Laden gibt es nicht.', 404);
    }

    $belegt = query_one(
        'SELECT id FROM stores WHERE user_id = ? AND name = ? AND id <> ?',
        [$user['id'], $name, $id],
    );
    if ($belegt) {
        fail('Diesen Namen benutzt schon ein anderer Laden.', 409);
    }

    execute('UPDATE stores SET name = ? WHERE id = ? AND user_id = ?', [$name, $id, $user['id']]);
    send_json(['store' => ['id' => $id, 'name' => $name]]);
}

/**
 * Löscht einen Laden. Posten, die ihn tragen, behalten ihren Platz auf der
 * Liste und verlieren nur die Zuordnung – dafür sorgt ON DELETE SET NULL.
 */
function route_stores_delete(string $id): never
{
    $user = require_user();
    $anzahl = execute('DELETE FROM stores WHERE id = ? AND user_id = ?', [$id, $user['id']]);
    if ($anzahl === 0) {
        fail('Diesen Laden gibt es nicht.', 404);
    }
    send_json(['deleted' => true]);
}
