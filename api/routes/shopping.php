<?php
/**
 * Einkaufsliste: anzeigen, aus dem Plan erzeugen, von Hand ergänzen, abhaken.
 */

require_once __DIR__ . '/../lib/shopping.php';

/**
 * Die Liste, nach Supermarktbereichen gruppiert.
 *
 * Erledigtes steht getrennt am Ende — es soll nicht zwischen dem stehen, was
 * noch zu holen ist, aber auch nicht verschwinden: Man will sehen, was schon
 * im Wagen liegt.
 */
function route_shopping_index(): never
{
    $user = require_user();

    $zeilen = query(
        'SELECT i.*, st.name AS store_name,
                GROUP_CONCAT(DISTINCT pe.eat_date ORDER BY pe.eat_date SEPARATOR "|") AS termine,
                GROUP_CONCAT(DISTINCT r.title ORDER BY r.title SEPARATOR "|") AS rezepte
           FROM shopping_list_items i
           LEFT JOIN stores st ON st.id = i.store_id
           LEFT JOIN shopping_list_contributions c ON c.item_id = i.id
           LEFT JOIN plan_entries pe ON pe.id = c.plan_entry_id
           LEFT JOIN recipes r ON r.id = pe.recipe_id AND r.deleted_at IS NULL
          WHERE i.user_id = ?
          GROUP BY i.id, st.name
          ORDER BY i.name ASC',
        [$user['id']],
    );

    $offen = [];
    $erledigt = [];
    $land = $user['state'] ?? FEIERTAG_STANDARD_LAND;

    foreach ($zeilen as $z) {
        $z['from_recipes'] = $z['rezepte'] ? explode('|', $z['rezepte']) : [];
        $z['needed_dates'] = $z['termine'] ? explode('|', $z['termine']) : [];
        $z['land'] = $land;
        $posten = einkauf_posten_ausgeben($z);
        if ($z['status'] === 'done') {
            $erledigt[] = $posten;
        } else {
            $offen[$z['store_category']][] = $posten;
        }
    }

    // In der Reihenfolge des Einkaufswegs ausgeben, leere Bereiche weglassen.
    $bereiche = [];
    foreach (LADEN_BEREICHE as $b) {
        if (!empty($offen[$b])) {
            $bereiche[] = ['category' => $b, 'items' => $offen[$b]];
        }
    }

    send_json([
        'sections'      => $bereiche,
        'done'          => $erledigt,
        'categories'    => LADEN_BEREICHE,
        // Ab wie vielen Tagen Vorlauf frische Ware einen zweiten Einkauf lohnt.
        'freshLeadDays' => FRISCHE_VORLAUF_TAGE,
    ]);
}

/**
 * Baut die Liste aus dem Plan neu auf.
 *
 * Von Hand hinzugefügte und schon erledigte Posten bleiben stehen.
 */
function route_shopping_generate(): never
{
    $user = require_user();
    $b = body();

    $von = plan_datum($b['from'] ?? null) ?? date('Y-m-d');
    $tage = max(1, min(60, (int) ($b['days'] ?? 7)));
    $ausnahmen = is_array($b['anyway'] ?? null) ? $b['anyway'] : [];

    $ergebnis = einkauf_erzeugen($user['id'], $von, $tage, $ausnahmen);
    send_json($ergebnis, 201);
}

function route_shopping_create(): never
{
    $user = require_user();
    $e = einkauf_eingaben();

    $id = new_id();
    execute(
        'INSERT INTO shopping_list_items
            (id, user_id, name, name_key, quantity, unit, store_category,
             source_type, status, needed_by_date, store_id, image_url, icon)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $id, $user['id'], $e['name'], $e['nameKey'], $e['quantity'], $e['unit'],
            $e['storeCategory'], 'manual', 'open', $e['neededByDate'],
            laden_pruefen($e['storeId'], $user['id']),
            $e['imageUrl'] === false ? null : $e['imageUrl'],
            $e['icon'] === false ? null : $e['icon'],
        ],
    );

    send_json(['item' => einkauf_posten_laden($id, $user['id'])], 201);
}

function route_shopping_update(string $id): never
{
    $user = require_user();

    if (!einkauf_posten_laden($id, $user['id'])) {
        fail('Der Posten wurde nicht gefunden.', 404);
    }

    $e = einkauf_eingaben();

    // Ein fehlendes Bildfeld lässt das vorhandene Bild in Ruhe; wer es
    // entfernen will, schickt einen leeren String.
    $bildTeil = $e['imageUrl'] === false ? '' : ', image_url = ?';
    $iconTeil = $e['icon'] === false ? '' : ', icon = ?';
    $werte = [
        $e['name'], $e['nameKey'], $e['quantity'], $e['unit'],
        $e['storeCategory'], $e['neededByDate'],
        laden_pruefen($e['storeId'], $user['id']),
    ];
    if ($e['imageUrl'] !== false) {
        $werte[] = $e['imageUrl'];
    }
    if ($e['icon'] !== false) {
        $werte[] = $e['icon'];
    }
    $werte[] = $id;
    $werte[] = $user['id'];

    execute(
        'UPDATE shopping_list_items
            SET name = ?, name_key = ?, quantity = ?, unit = ?,
                store_category = ?, needed_by_date = ?, store_id = ?' . $bildTeil . $iconTeil . '
          WHERE id = ? AND user_id = ?',
        $werte,
    );

    send_json(['item' => einkauf_posten_laden($id, $user['id'])]);
}

/** Hakt ab oder nimmt es zurück. */
function route_shopping_toggle(string $id): never
{
    $user = require_user();

    if (!einkauf_posten_laden($id, $user['id'])) {
        fail('Der Posten wurde nicht gefunden.', 404);
    }

    $erledigt = (bool) (body()['done'] ?? true);
    execute(
        'UPDATE shopping_list_items
            SET status = ?, done_at = ' . ($erledigt ? 'NOW()' : 'NULL') . '
          WHERE id = ? AND user_id = ?',
        [$erledigt ? 'done' : 'open', $id, $user['id']],
    );

    send_json(['item' => einkauf_posten_laden($id, $user['id'])]);
}

function route_shopping_delete(string $id): never
{
    $user = require_user();
    $anzahl = execute(
        'DELETE FROM shopping_list_items WHERE id = ? AND user_id = ?',
        [$id, $user['id']],
    );
    if ($anzahl === 0) {
        fail('Der Posten wurde nicht gefunden.', 404);
    }
    send_json(['deleted' => true]);
}

/** Räumt die erledigten Posten weg – nach dem Einkauf. */
function route_shopping_clear_done(): never
{
    $user = require_user();
    $anzahl = execute(
        "DELETE FROM shopping_list_items WHERE user_id = ? AND status = 'done'",
        [$user['id']],
    );
    send_json(['deleted' => $anzahl]);
}

/** Nimmt die Ladenkennung nur an, wenn sie dem Nutzer gehört. */
function laden_pruefen(?string $ladenId, string $userId): ?string
{
    if ($ladenId === null || $ladenId === '') {
        return null;
    }
    $z = query_one('SELECT id FROM stores WHERE id = ? AND user_id = ?', [$ladenId, $userId]);
    return $z ? $ladenId : null;
}

function einkauf_posten_laden(string $id, string $userId): ?array
{
    $z = query_one(
        'SELECT i.*, st.name AS store_name
           FROM shopping_list_items i
           LEFT JOIN stores st ON st.id = i.store_id
          WHERE i.id = ? AND i.user_id = ?',
        [$id, $userId],
    );
    return $z ? einkauf_posten_ausgeben($z) : null;
}
