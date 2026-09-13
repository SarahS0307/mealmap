<?php
/**
 * Vorrat: was vorgekocht, eingefroren oder sonst vorrätig ist.
 *
 * Gezählt wird in <strong>Portionen</strong> – so gibt Sarah es an: „vier
 * Portionen Reis eingefroren“. Andere Einheiten sind erlaubt, damit später
 * auch der Vorratsschrank abgebildet werden kann (500 g Mehl), aber die
 * Portion ist der Normalfall und die Vorgabe.
 *
 * Ein Posten muss kein Rezept haben. „Reis“ steht für sich; ein vorgekochtes
 * Rezept hinterlässt einen Posten mit Bezug darauf.
 */

require_once __DIR__ . '/ingredients.php';
require_once __DIR__ . '/haltbarkeit.php';
require_once __DIR__ . '/laden.php';

/** Vorgabeeinheit. Alles, was gekocht und eingefroren wird, zählt so. */
const VORRAT_EINHEIT = 'Portion';

/**
 * Wo etwas liegt.
 *
 * Der Gefrierschrank steht bewusst am Ende: Was dort liegt, ist haltbar und
 * eilt nicht — man schaut zuerst nach, was demnächst verdirbt.
 */
const VORRAT_ORTE = ['Kühlschrank', 'Vorratsschrank', 'Sonstiges', 'Gefrierschrank'];

/** Fertiges Essen wird in Portionen gezählt, Zutaten in Gramm oder Stück. */
const VORRAT_ART_GEKOCHT = 'cooked';
const VORRAT_ART_ZUTAT = 'ingredient';

function vorrat_ausgeben(array $z): array
{
    return [
        'id'          => $z['id'],
        'name'        => $z['name'],
        'kind'        => $z['kind'] ?? VORRAT_ART_ZUTAT,
        'storeCategory' => $z['store_category'] ?? 'other',
        // Fertiges Essen bekommt ein Tellersinnbild: Aus "Kichererbsen-Curry"
        // ein Gewürzglas zu machen wäre irreführend – das ist kein Curry-
        // pulver, sondern eine Mahlzeit.
        'icon'        => ($z['kind'] ?? VORRAT_ART_ZUTAT) === VORRAT_ART_GEKOCHT
            ? '🍲'
            : laden_sinnbild_raten($z['name'], $z['store_category'] ?? 'other'),
        // Wofür der Posten schon eingeplant ist – "SO Nudelsalat".
        'reservedFor' => $z['reserved_for'] ?? [],
        'quantity'    => (float) $z['quantity'],
        'unit'        => $z['unit'],
        'location'    => $z['location'],
        'recipeId'    => $z['recipe_id'],
        'recipeTitle' => $z['recipe_title'] ?? null,
        'bestBefore'  => $z['best_before'],
        'daysLeft'    => haltbarkeit_tage_bis($z['best_before']),
        'perishing'   => $stufe = haltbarkeit_raten($z['name']),
        'freshness'   => haltbarkeit_zustand($z['best_before'], $stufe),
        'freshnessNote' => haltbarkeit_hinweis($stufe),
        'createdAt'   => $z['created_at'],
    ];
}

/**
 * Wofür Vorratsposten schon eingeplant sind.
 *
 * Ergebnis je Posten: "SO Nudelsalat" oder "500 g MO Nudelauflauf" – Wochentag
 * und Gericht, damit man im Gefrierschrank sieht, was noch gebraucht wird und
 * was frei ist. Nur ungebuchte Reservierungen zählen; was schon gegessen ist,
 * belegt nichts mehr.
 */
function vorrat_reservierungen(array $postenIds, string $userId): array
{
    if (!$postenIds) {
        return [];
    }

    $platzhalter = implode(',', array_fill(0, count($postenIds), '?'));
    $zeilen = query(
        "SELECT pes.stock_item_id, pes.portions, pe.eat_date, pe.meal_slot,
                r.title AS recipe_title, pe.free_text, s.unit
           FROM plan_entry_stock pes
           JOIN plan_entries pe ON pe.id = pes.plan_entry_id
           LEFT JOIN stock_items s ON s.id = pes.stock_item_id
           LEFT JOIN recipes r ON r.id = pe.recipe_id AND r.deleted_at IS NULL
          WHERE pes.user_id = ? AND pes.consumed_at IS NULL
            AND pes.stock_item_id IN ($platzhalter)
          ORDER BY pe.eat_date ASC",
        array_merge([$userId], $postenIds),
    );

    $kurz = ['', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'];
    $nach = [];
    foreach ($zeilen as $z) {
        $nach[$z['stock_item_id']][] = [
            'day'      => $kurz[(int) date('N', strtotime($z['eat_date']))],
            'date'     => $z['eat_date'],
            'portions' => (float) $z['portions'],
            'unit'     => $z['unit'],
            'what'     => $z['recipe_title'] ?? $z['free_text'] ?? 'geplant',
        ];
    }
    return $nach;
}

function vorrat_laden(string $id, string $userId): ?array
{
    $z = query_one(
        'SELECT s.*, r.title AS recipe_title
           FROM stock_items s
           LEFT JOIN recipes r ON r.id = s.recipe_id AND r.deleted_at IS NULL
          WHERE s.id = ? AND s.user_id = ?',
        [$id, $userId],
    );
    return $z ? vorrat_ausgeben($z) : null;
}

/** Prüft die Eingaben für einen Vorratsposten. */
function vorrat_eingaben(): array
{
    $b = body();

    $name = trim((string) ($b['name'] ?? ''));
    if ($name === '') {
        fail('Bitte gib an, was es ist.');
    }

    $menge = (float) ($b['quantity'] ?? 0);
    if ($menge <= 0 || $menge > 9999) {
        fail('Die Menge muss größer als 0 sein.');
    }

    // Fertiges Essen zählt in Portionen, Zutaten in Gramm oder Stück. Die
    // Vorgabeeinheit hängt deshalb an der Art.
    $art = ($b['kind'] ?? '') === VORRAT_ART_GEKOCHT ? VORRAT_ART_GEKOCHT : VORRAT_ART_ZUTAT;
    $vorgabe = $art === VORRAT_ART_GEKOCHT ? VORRAT_EINHEIT : 'g';

    $einheit = trim((string) ($b['unit'] ?? '')) ?: $vorgabe;
    $ort = trim((string) ($b['location'] ?? '')) ?: null;

    $bereich = trim((string) ($b['storeCategory'] ?? ''));
    if (!in_array($bereich, LADEN_BEREICHE, true)) {
        $bereich = laden_bereich_raten($name);
    }

    $haltbar = trim((string) ($b['bestBefore'] ?? ''));
    if ($haltbar !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $haltbar)) {
        fail('Das Haltbarkeitsdatum sieht nicht nach einem Datum aus.');
    }

    return [
        'name'       => mb_substr($name, 0, 191),
        'nameKey'    => zutaten_schluessel($name),
        'quantity'   => $menge,
        'unit'       => mb_substr($einheit, 0, 32),
        'kind'       => $art,
        'storeCategory' => $bereich,
        'location'   => $ort === null ? null : mb_substr($ort, 0, 64),
        'recipeId'   => trim((string) ($b['recipeId'] ?? '')) ?: null,
        'bestBefore' => $haltbar ?: null,
    ];
}

/**
 * Legt einen Posten an – oder schlägt ihn auf einen gleichartigen auf.
 *
 * Gleichartig heißt: derselbe vereinheitlichte Name, dieselbe Einheit,
 * derselbe Ort, dasselbe Haltbarkeitsdatum. Sonst stünden nach dreimal
 * Reis-Einfrieren drei Zeilen „Reis“ untereinander.
 */
function vorrat_zubuchen(string $userId, array $e): string
{
    $vorhanden = query_one(
        'SELECT id, quantity FROM stock_items
          WHERE user_id = ? AND name_key = ? AND unit = ?
            AND (location <=> ?) AND (best_before <=> ?)
          LIMIT 1',
        [$userId, $e['nameKey'], $e['unit'], $e['location'], $e['bestBefore']],
    );

    if ($vorhanden) {
        execute(
            'UPDATE stock_items SET quantity = quantity + ? WHERE id = ?',
            [$e['quantity'], $vorhanden['id']],
        );
        return $vorhanden['id'];
    }

    $id = new_id();
    execute(
        'INSERT INTO stock_items
            (id, user_id, name, name_key, quantity, unit, location, recipe_id,
             best_before, kind, store_category)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $id, $userId, $e['name'], $e['nameKey'], $e['quantity'],
            $e['unit'], $e['location'], $e['recipeId'], $e['bestBefore'],
            $e['kind'] ?? VORRAT_ART_ZUTAT,
            $e['storeCategory'] ?? laden_bereich_raten($e['name']),
        ],
    );
    return $id;
}

/**
 * Bucht Portionen ab. Ein Posten, der auf 0 fällt, verschwindet – ein Eintrag
 * „0 Portionen Reis“ hilft niemandem.
 *
 * Gibt zurück, wie viel tatsächlich abgebucht wurde; das kann weniger sein als
 * gewünscht, wenn der Bestand nicht reicht.
 */
function vorrat_abbuchen(string $userId, string $id, float $menge): float
{
    $z = query_one(
        'SELECT quantity FROM stock_items WHERE id = ? AND user_id = ?',
        [$id, $userId],
    );
    if (!$z) {
        return 0.0;
    }

    $da = (float) $z['quantity'];
    $ab = min($da, $menge);
    $rest = round($da - $ab, 3);

    if ($rest <= 0) {
        execute('DELETE FROM stock_items WHERE id = ? AND user_id = ?', [$id, $userId]);
    } else {
        execute('UPDATE stock_items SET quantity = ? WHERE id = ?', [$rest, $id]);
    }

    return $ab;
}

/** Die Vorratsposten, aus denen eine geplante Mahlzeit besteht. */
function vorrat_zu_eintrag(string $eintragId, string $userId): array
{
    return array_map(
        static fn (array $z): array => [
            'stockItemId' => $z['stock_item_id'],
            'name'        => $z['name'],
            'portions'    => (float) $z['portions'],
            'unit'        => $z['unit'],
            'location'    => $z['location'],
            'available'   => $z['quantity'] === null ? null : (float) $z['quantity'],
            'consumedAt'  => $z['consumed_at'],
        ],
        query(
            'SELECT pes.stock_item_id, pes.portions, pes.consumed_at,
                    s.name, s.unit, s.location, s.quantity
               FROM plan_entry_stock pes
               LEFT JOIN stock_items s ON s.id = pes.stock_item_id
              WHERE pes.plan_entry_id = ? AND pes.user_id = ?
              ORDER BY s.name ASC',
            [$eintragId, $userId],
        ),
    );
}

/**
 * Dasselbe für viele Einträge auf einmal, als Abbildung Eintrag => Posten.
 *
 * Eine Abfrage statt einer je Eintrag – bei einem Monat mit sechs Slots am Tag
 * wären das sonst schnell hundertachtzig.
 */
function vorrat_zu_eintraegen(array $eintragIds, string $userId): array
{
    if (!$eintragIds) {
        return [];
    }

    $platzhalter = implode(',', array_fill(0, count($eintragIds), '?'));
    $zeilen = query(
        "SELECT pes.plan_entry_id, pes.stock_item_id, pes.portions, pes.consumed_at,
                s.name, s.unit, s.location, s.quantity
           FROM plan_entry_stock pes
           LEFT JOIN stock_items s ON s.id = pes.stock_item_id
          WHERE pes.user_id = ? AND pes.plan_entry_id IN ($platzhalter)
          ORDER BY s.name ASC",
        array_merge([$userId], $eintragIds),
    );

    $nach = [];
    foreach ($zeilen as $z) {
        $nach[$z['plan_entry_id']][] = [
            'stockItemId' => $z['stock_item_id'],
            'name'        => $z['name'],
            'portions'    => (float) $z['portions'],
            'unit'        => $z['unit'],
            'location'    => $z['location'],
            'available'   => $z['quantity'] === null ? null : (float) $z['quantity'],
            'consumedAt'  => $z['consumed_at'],
        ];
    }
    return $nach;
}

/**
 * Schreibt fest, aus welchen Vorratsposten ein Eintrag besteht.
 *
 * Schon abgebuchte Verknüpfungen bleiben unangetastet – wer nach dem Essen die
 * Zusammenstellung ändert, soll den Vorrat nicht rückwirkend verbiegen.
 */
function vorrat_eintrag_setzen(string $eintragId, string $userId, ?array $liste): void
{
    if ($liste === null) {
        return;
    }

    execute(
        'DELETE FROM plan_entry_stock
          WHERE plan_entry_id = ? AND user_id = ? AND consumed_at IS NULL',
        [$eintragId, $userId],
    );

    foreach ($liste as $p) {
        $postenId = trim((string) ($p['stockItemId'] ?? ''));
        $portionen = (float) ($p['portions'] ?? 1);
        if ($postenId === '' || $portionen <= 0) {
            continue;
        }

        $gehoert = query_one(
            'SELECT id FROM stock_items WHERE id = ? AND user_id = ?',
            [$postenId, $userId],
        );
        if (!$gehoert) {
            continue;
        }

        execute(
            'INSERT INTO plan_entry_stock (id, user_id, plan_entry_id, stock_item_id, portions)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE portions = VALUES(portions)',
            [new_id(), $userId, $eintragId, $postenId, $portionen],
        );
    }
}

/**
 * Bucht beim Abhaken von "gegessen" den Vorrat ab – und beim Zurücknehmen
 * wieder zu. Der Haken ist damit in beide Richtungen folgenlos umkehrbar.
 */
function vorrat_verbrauch_umschalten(string $eintragId, string $userId, bool $gegessen): void
{
    $posten = query(
        'SELECT id, stock_item_id, portions, consumed_at
           FROM plan_entry_stock WHERE plan_entry_id = ? AND user_id = ?',
        [$eintragId, $userId],
    );

    foreach ($posten as $p) {
        $schonAb = $p['consumed_at'] !== null;

        if ($gegessen && !$schonAb) {
            vorrat_abbuchen($userId, $p['stock_item_id'], (float) $p['portions']);
            execute('UPDATE plan_entry_stock SET consumed_at = NOW() WHERE id = ?', [$p['id']]);
        } elseif (!$gegessen && $schonAb) {
            // Zurückbuchen auf denselben Posten. Ist er inzwischen ganz
            // aufgebraucht und gelöscht, lässt sich nichts mehr zuordnen –
            // dann bleibt es beim Abgebucht.
            $noch = query_one(
                'SELECT id FROM stock_items WHERE id = ? AND user_id = ?',
                [$p['stock_item_id'], $userId],
            );
            if ($noch) {
                execute(
                    'UPDATE stock_items SET quantity = quantity + ? WHERE id = ?',
                    [(float) $p['portions'], $p['stock_item_id']],
                );
                execute('UPDATE plan_entry_stock SET consumed_at = NULL WHERE id = ?', [$p['id']]);
            }
        }
    }
}
