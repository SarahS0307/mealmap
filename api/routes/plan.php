<?php
/**
 * Meal-Prep-Plan: datumsweise Ansicht mit Einträgen je Mahlzeit.
 *
 * Zwei Ebenen, wie im Konzept:
 *   plan_days     Eigenschaften des ganzen Tages – der Einkaufstermin
 *   plan_entries  einzelne Mahlzeiten – Rezept, Portionen, für wen,
 *                 Abwesenheit, und getrennt davon Koch- und Essenstermin
 *
 * Der Kochtermin kann vom Essenstermin abweichen: sonntags kochen, dienstags
 * essen. Beide Termine stehen deshalb am selben Eintrag.
 */

require_once __DIR__ . '/../lib/plan.php';
require_once __DIR__ . '/../lib/suggest.php';
require_once __DIR__ . '/../lib/shopping.php';

/**
 * Gibt einen Zeitraum zurück, Tag für Tag – auch Tage ohne Einträge, damit
 * die Ansicht eine durchgehende Liste zeichnen kann.
 */
function route_plan_index(): never
{
    $user = require_user();

    $von = plan_datum($_GET['from'] ?? null) ?? date('Y-m-d');
    $tage = max(1, min(60, (int) ($_GET['days'] ?? 14)));
    $bis = date('Y-m-d', strtotime("$von +" . ($tage - 1) . " days"));

    $eintraege = query(
        'SELECT pe.*, r.title AS recipe_title, r.servings AS recipe_servings
           FROM plan_entries pe
           LEFT JOIN recipes r ON r.id = pe.recipe_id AND r.deleted_at IS NULL
          WHERE pe.user_id = ? AND pe.eat_date BETWEEN ? AND ?
          ORDER BY pe.eat_date ASC, pe.meal_slot ASC',
        [$user['id'], $von, $bis],
    );

    $tagesdaten = query(
        'SELECT date, is_shopping_day, note FROM plan_days
          WHERE user_id = ? AND date BETWEEN ? AND ?',
        [$user['id'], $von, $bis],
    );

    $nachDatum = [];
    foreach ($tagesdaten as $t) {
        $nachDatum[$t['date']] = $t;
    }

    // Vorratszuordnung für alle Einträge auf einmal, statt je Eintrag.
    $vorrat = vorrat_zu_eintraegen(
        array_column($eintraege, 'id'),
        $user['id'],
    );

    $nachTag = [];
    foreach ($eintraege as $e) {
        $nachTag[$e['eat_date']][] = plan_eintrag_ausgeben($e, $vorrat);
    }

    // Auch Tage ohne Einträge auflisten.
    // Die Feiertagslage liefert der Server mit, damit die Oberfläche die
    // Tabelle nicht ein zweites Mal führen muss.
    $land = $user['state'] ?? FEIERTAG_STANDARD_LAND;

    $liste = [];
    for ($i = 0; $i < $tage; $i++) {
        $datum = date('Y-m-d', strtotime("$von +$i days"));
        $feiertag = feiertag_name($datum, $land);
        $liste[] = [
            'date'          => $datum,
            'isShoppingDay' => (bool) ($nachDatum[$datum]['is_shopping_day'] ?? false),
            'note'          => $nachDatum[$datum]['note'] ?? null,
            'holiday'       => $feiertag,
            'entries'       => $nachTag[$datum] ?? [],
        ];
    }

    // Was an diesen Tagen gekocht, aber später gegessen wird – die Ansicht
    // zeigt damit auch den Kochtermin an, nicht nur den Essenstermin.
    $kochtermine = query(
        'SELECT pe.id, pe.cook_date, pe.eat_date, pe.meal_slot, pe.portion_count,
                pe.cooked_at, r.title AS recipe_title
           FROM plan_entries pe
           LEFT JOIN recipes r ON r.id = pe.recipe_id AND r.deleted_at IS NULL
          WHERE pe.user_id = ? AND pe.cook_date BETWEEN ? AND ?
            AND (pe.cook_date <> pe.eat_date OR pe.cook_date IS NULL)',
        [$user['id'], $von, $bis],
    );

    send_json([
        'from'      => $von,
        'to'        => $bis,
        'days'      => $liste,
        'cookDates' => array_map(
            static fn(array $k): array => [
                'id'           => $k['id'],
                'cookDate'     => $k['cook_date'],
                'eatDate'      => $k['eat_date'],
                'mealSlot'     => $k['meal_slot'],
                'portionCount' => (int) $k['portion_count'],
                'recipeTitle'  => $k['recipe_title'],
                'cookedAt'     => $k['cooked_at'],
            ],
            $kochtermine,
        ),
    ]);
}

function route_plan_entry_create(): never
{
    $user = require_user();
    $e = plan_eingaben();

    $tagId = plan_tag_sicherstellen($user['id'], $e['eatDate']);
    $id = new_id();

    execute(
        'INSERT INTO plan_entries
            (id, user_id, plan_day_id, cook_date, eat_date, meal_slot, recipe_id,
             free_text, portion_count, for_whom, guest_count, status, is_absent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $id, $user['id'], $tagId, $e['cookDate'], $e['eatDate'], $e['mealSlot'],
            $e['recipeId'], $e['freeText'], $e['portionCount'],
            json_encode($e['forWhom'], JSON_UNESCAPED_UNICODE), $e['guestCount'],
            $e['status'], $e['isAbsent'],
        ],
    );

    vorrat_eintrag_setzen($id, $user['id'], $e['fromStock']);

    send_json(['entry' => plan_eintrag_laden($id, $user['id'])], 201);
}

function route_plan_entry_update(string $id): never
{
    $user = require_user();

    if (!plan_eintrag_laden($id, $user['id'])) {
        fail('Diesen Eintrag gibt es nicht.', 404);
    }

    $e = plan_eingaben();
    $tagId = plan_tag_sicherstellen($user['id'], $e['eatDate']);

    execute(
        'UPDATE plan_entries
            SET plan_day_id = ?, cook_date = ?, eat_date = ?, meal_slot = ?,
                recipe_id = ?, free_text = ?, portion_count = ?, for_whom = ?,
                guest_count = ?, status = ?, is_absent = ?
          WHERE id = ?',
        [
            $tagId, $e['cookDate'], $e['eatDate'], $e['mealSlot'], $e['recipeId'],
            $e['freeText'], $e['portionCount'],
            json_encode($e['forWhom'], JSON_UNESCAPED_UNICODE), $e['guestCount'],
            $e['status'], $e['isAbsent'], $id,
        ],
    );

    vorrat_eintrag_setzen($id, $user['id'], $e['fromStock']);

    send_json(['entry' => plan_eintrag_laden($id, $user['id'])]);
}

function route_plan_entry_delete(string $id): never
{
    $user = require_user();

    if (!plan_eintrag_laden($id, $user['id'])) {
        fail('Diesen Eintrag gibt es nicht.', 404);
    }

    // Erst den Anteil aus der Einkaufsliste herausrechnen, dann löschen: Die
    // Fremdschlüssel-Kaskade räumt die Beiträge sonst weg, bevor man weiß, wie
    // viel abzuziehen war.
    $inDenVorrat = einkauf_beitrag_entfernen($id, $user['id']);

    execute('DELETE FROM plan_entries WHERE id = ?', [$id]);
    send_json(['deleted' => true, 'toStock' => $inDenVorrat]);
}

/**
 * Hakt einen Eintrag als gekocht oder gegessen ab – oder nimmt das zurück.
 *
 * Ausdrücklich von Hand: Die App leitet nichts daraus ab, dass ein Datum
 * vergangen ist. Ein vergangener Sonntag heißt nicht, dass gekocht wurde.
 */
function route_plan_entry_mark(string $id): never
{
    $user = require_user();

    if (!plan_eintrag_laden($id, $user['id'])) {
        fail('Diesen Eintrag gibt es nicht.', 404);
    }

    $b = body();
    $feld = match ($b['what'] ?? '') {
        'cooked' => 'cooked_at',
        'eaten'  => 'eaten_at',
        default  => null,
    };
    if ($feld === null) {
        fail('Unbekannte Markierung. Erlaubt sind "cooked" und "eaten".');
    }

    // NOW() statt einer PHP-Zeit: eine Uhr im Spiel, keine Zeitzonenfallen.
    $gesetzt = (bool) ($b['value'] ?? true);
    execute(
        "UPDATE plan_entries SET $feld = " . ($gesetzt ? 'NOW()' : 'NULL') . ' WHERE id = ?',
        [$id],
    );

    // Wer isst, verbraucht den Vorrat – und wer den Haken zurücknimmt, bekommt
    // ihn wieder. Nur beim Essen, nicht beim Kochen: gekocht heißt noch nicht
    // aufgebraucht.
    if ($feld === 'eaten_at') {
        vorrat_verbrauch_umschalten($id, $user['id'], $gesetzt);
    }

    send_json(['entry' => plan_eintrag_laden($id, $user['id'])]);
}

/** Setzt Eigenschaften eines ganzen Tages – bislang der Einkaufstermin. */
function route_plan_day_update(): never
{
    $user = require_user();

    $datum = plan_datum(body()['date'] ?? null);
    if ($datum === null) {
        fail('Es fehlt ein gültiges Datum.');
    }

    $b = body();

    // Sonntags haben die Läden zu – das ist eine harte Grenze. Feiertage sind
    // nur "teilweise eingeschränkt", deshalb lassen sie sich setzen, aber nur
    // mit ausdrücklichem Ja: die Oberfläche fragt vorher nach.
    if (!empty($b['isShoppingDay'])) {
        $land = $user['state'] ?? FEIERTAG_STANDARD_LAND;

        if ((int) date('N', strtotime($datum)) === 7) {
            fail('Sonntags kann man nicht einkaufen – wähle einen anderen Tag.', 422);
        }

        $feiertag = feiertag_name($datum, $land);
        if ($feiertag !== null && empty($b['trotzFeiertag'])) {
            send_json([
                'needsDecision' => 'feiertag',
                'holiday'       => $feiertag,
                'message'       => "$feiertag – die Läden haben zu oder nur eingeschränkt offen.",
            ], 409);
        }
    }

    $tagId = plan_tag_sicherstellen($user['id'], $datum);

    execute(
        'UPDATE plan_days SET is_shopping_day = ?, note = ? WHERE id = ?',
        [
            !empty($b['isShoppingDay']) ? 1 : 0,
            trim((string) ($b['note'] ?? '')) ?: null,
            $tagId,
        ],
    );

    $tag = query_one('SELECT date, is_shopping_day, note FROM plan_days WHERE id = ?', [$tagId]);
    send_json([
        'day' => [
            'date'          => $tag['date'],
            'isShoppingDay' => (bool) $tag['is_shopping_day'],
            'note'          => $tag['note'],
        ],
    ]);
}

/**
 * Schlägt für eine Woche Rezepte vor und legt sie als Vorschläge an.
 *
 * Füllt nur leere Slots. Wer schon etwas geplant hat, behält es – auch dann,
 * wenn der Vorschlagslauf mehrfach gestartet wird.
 */
function route_plan_suggest(): never
{
    $user = require_user();
    $b = body();

    $von  = plan_datum($b['from'] ?? null) ?? date('Y-m-d');
    $tage = max(1, min(14, (int) ($b['days'] ?? 7)));

    $neu = vorschlag_woche($user, $von, $tage);
    if (!$neu) {
        $hatRezepte = query_one(
            'SELECT id FROM recipes WHERE user_id = ? AND deleted_at IS NULL LIMIT 1',
            [$user['id']],
        );
        send_json([
            'entries' => [],
            'created' => 0,
            'reason'  => $hatRezepte ? 'voll' : 'keine_rezepte',
        ]);
    }

    $ids = [];
    db()->beginTransaction();
    try {
        foreach ($neu as $e) {
            $tagId = plan_tag_sicherstellen($user['id'], $e['eatDate']);
            $id = new_id();
            execute(
                'INSERT INTO plan_entries
                    (id, user_id, plan_day_id, cook_date, eat_date, meal_slot, recipe_id,
                     free_text, portion_count, for_whom, guest_count, status, is_absent)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $id, $user['id'], $tagId, $e['cookDate'], $e['eatDate'], $e['mealSlot'],
                    $e['recipeId'], $e['freeText'], $e['portionCount'],
                    json_encode($e['forWhom'], JSON_UNESCAPED_UNICODE), $e['guestCount'],
                    $e['status'], $e['isAbsent'],
                ],
            );
            if (!empty($e['fromStock'])) {
                vorrat_eintrag_setzen($id, $user['id'], $e['fromStock']);
            }
            $ids[] = $id;
        }
        db()->commit();
    } catch (Throwable $ex) {
        db()->rollBack();
        throw $ex;
    }

    $eintraege = [];
    foreach ($ids as $id) {
        $eintraege[] = plan_eintrag_laden($id, $user['id']);
    }

    send_json(['entries' => $eintraege, 'created' => count($eintraege)], 201);
}

/**
 * Verwirft alle unbestätigten Vorschläge eines Zeitraums.
 *
 * Bestätigte Einträge bleiben stehen, ebenso Vorschläge, die schon als
 * gekocht oder gegessen abgehakt wurden – die waren offensichtlich gewollt.
 */
function route_plan_suggestions_clear(): never
{
    $user = require_user();

    $von  = plan_datum($_GET['from'] ?? null) ?? date('Y-m-d');
    $tage = max(1, min(60, (int) ($_GET['days'] ?? 7)));
    $bis  = date('Y-m-d', strtotime("$von +" . ($tage - 1) . ' days'));

    $anzahl = execute(
        "DELETE FROM plan_entries
          WHERE user_id = ? AND status = 'suggested'
            AND eat_date BETWEEN ? AND ?
            AND cooked_at IS NULL AND eaten_at IS NULL",
        [$user['id'], $von, $bis],
    );

    send_json(['deleted' => $anzahl]);
}

/** Macht aus einem Vorschlag einen festen Eintrag. */
function route_plan_entry_confirm(string $id): never
{
    $user = require_user();

    $vorhanden = query_one(
        'SELECT id FROM plan_entries WHERE id = ? AND user_id = ?',
        [$id, $user['id']],
    );
    if (!$vorhanden) {
        fail('Eintrag nicht gefunden.', 404);
    }

    execute(
        "UPDATE plan_entries SET status = 'confirmed' WHERE id = ? AND user_id = ?",
        [$id, $user['id']],
    );

    send_json(['entry' => plan_eintrag_laden($id, $user['id'])]);
}
