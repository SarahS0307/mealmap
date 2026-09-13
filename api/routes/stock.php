<?php
/**
 * Vorrat: anlegen, ändern, abbuchen, löschen.
 *
 * Gezählt wird in Portionen, siehe lib/stock.php.
 */

require_once __DIR__ . '/../lib/stock.php';

function route_stock_index(): never
{
    $user = require_user();

    $zeilen = query(
        'SELECT s.*, r.title AS recipe_title
           FROM stock_items s
           LEFT JOIN recipes r ON r.id = s.recipe_id AND r.deleted_at IS NULL
          WHERE s.user_id = ?
          ORDER BY (s.best_before IS NULL) ASC, s.best_before ASC, s.name ASC',
        [$user['id']],
    );

    // Wofür die Posten schon verplant sind – in einer Abfrage für alle.
    $reserviert = vorrat_reservierungen(array_column($zeilen, 'id'), $user['id']);
    foreach ($zeilen as $i => $z) {
        $zeilen[$i]['reserved_for'] = $reserviert[$z['id']] ?? [];
    }

    send_json([
        'items'      => array_map('vorrat_ausgeben', $zeilen),
        'locations'  => VORRAT_ORTE,
        'unit'       => VORRAT_EINHEIT,
        'categories' => LADEN_BEREICHE,
    ]);
}

function route_stock_create(): never
{
    $user = require_user();
    $e = vorrat_eingaben();

    $id = vorrat_zubuchen($user['id'], $e);
    send_json(['item' => vorrat_laden($id, $user['id'])], 201);
}

function route_stock_update(string $id): never
{
    $user = require_user();

    $vorhanden = query_one(
        'SELECT id FROM stock_items WHERE id = ? AND user_id = ?',
        [$id, $user['id']],
    );
    if (!$vorhanden) {
        fail('Der Posten wurde nicht gefunden.', 404);
    }

    $e = vorrat_eingaben();
    execute(
        'UPDATE stock_items
            SET name = ?, name_key = ?, quantity = ?, unit = ?, location = ?,
                recipe_id = ?, best_before = ?, kind = ?, store_category = ?
          WHERE id = ? AND user_id = ?',
        [
            $e['name'], $e['nameKey'], $e['quantity'], $e['unit'], $e['location'],
            $e['recipeId'], $e['bestBefore'], $e['kind'], $e['storeCategory'],
            $id, $user['id'],
        ],
    );

    send_json(['item' => vorrat_laden($id, $user['id'])]);
}

function route_stock_delete(string $id): never
{
    $user = require_user();
    $anzahl = execute(
        'DELETE FROM stock_items WHERE id = ? AND user_id = ?',
        [$id, $user['id']],
    );
    if ($anzahl === 0) {
        fail('Der Posten wurde nicht gefunden.', 404);
    }
    send_json(['deleted' => true]);
}

/**
 * Bucht Portionen ab, ohne den Umweg über einen Plan-Eintrag – etwa wenn
 * zwischendurch etwas aufgegessen oder weggeworfen wird.
 */
function route_stock_take(string $id): never
{
    $user = require_user();
    $menge = (float) (body()['quantity'] ?? 1);

    if ($menge <= 0) {
        fail('Die Menge muss größer als 0 sein.');
    }

    $ab = vorrat_abbuchen($user['id'], $id, $menge);
    if ($ab <= 0) {
        fail('Der Posten wurde nicht gefunden.', 404);
    }

    send_json(['taken' => $ab, 'item' => vorrat_laden($id, $user['id'])]);
}

/**
 * Friert ein, was von einem gekochten Plan-Eintrag übrig ist.
 *
 * Die Portionszahl gibt Sarah selbst an – so beschreibt sie es auch: „vier
 * Portionen Reis eingefroren“. Vorbelegt ist die Portionszahl des Eintrags,
 * geändert werden darf sie immer.
 */
function route_plan_entry_freeze(string $id): never
{
    $user = require_user();
    $b = body();

    $eintrag = query_one(
        'SELECT pe.*, r.title AS recipe_title
           FROM plan_entries pe
           LEFT JOIN recipes r ON r.id = pe.recipe_id AND r.deleted_at IS NULL
          WHERE pe.id = ? AND pe.user_id = ?',
        [$id, $user['id']],
    );
    if (!$eintrag) {
        fail('Der Eintrag wurde nicht gefunden.', 404);
    }

    $portionen = (float) ($b['portions'] ?? $eintrag['portion_count']);
    if ($portionen <= 0 || $portionen > 999) {
        fail('Die Portionszahl muss größer als 0 sein.');
    }

    $name = trim((string) ($b['name'] ?? ''))
        ?: (string) ($eintrag['recipe_title'] ?? $eintrag['free_text'] ?? 'Vorgekochtes');

    $ort = trim((string) ($b['location'] ?? '')) ?: 'Gefrierschrank';

    $haltbar = trim((string) ($b['bestBefore'] ?? ''));
    if ($haltbar !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $haltbar)) {
        fail('Das Haltbarkeitsdatum sieht nicht nach einem Datum aus.');
    }

    $postenId = vorrat_zubuchen($user['id'], [
        'name'       => mb_substr($name, 0, 191),
        'nameKey'    => zutaten_schluessel($name),
        'quantity'   => $portionen,
        'unit'       => VORRAT_EINHEIT,
        'location'   => $ort,
        'recipeId'   => $eintrag['recipe_id'],
        'bestBefore' => $haltbar ?: null,
        // Was aus dem Plan kommt, ist fertiges Essen und zählt in Portionen.
        'kind'          => VORRAT_ART_GEKOCHT,
        'storeCategory' => 'other',
    ]);

    send_json(['item' => vorrat_laden($postenId, $user['id'])], 201);
}
