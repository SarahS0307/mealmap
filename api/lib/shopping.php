<?php
/**
 * Einkaufsliste: entsteht aus dem Plan, ergänzbar von Hand.
 *
 * Zwei Ebenen, wie beim Plan:
 *   shopping_list_items          ein Posten auf der Liste
 *   shopping_list_contributions  welcher Plan-Eintrag wie viel dazu beiträgt
 *
 * Die zweite Tabelle ist der Grund, warum ein Rezept sauber wieder aus der
 * Liste verschwinden kann: Fliegt ein Plan-Eintrag raus, wird genau sein
 * Anteil abgezogen – nicht der ganze Posten, denn andere Rezepte brauchen die
 * Zwiebeln vielleicht auch.
 */

require_once __DIR__ . '/ingredients.php';
require_once __DIR__ . '/laden.php';
require_once __DIR__ . '/stock.php';
require_once __DIR__ . '/haltbarkeit.php';
require_once __DIR__ . '/feiertage.php';

/** Rundet wie beim Kochen – niemand kauft 133,333 g ab. */
function einkauf_runden(?float $wert): ?float
{
    if ($wert === null) {
        return null;
    }
    if ($wert >= 100) return round($wert / 5) * 5;
    if ($wert >= 20)  return round($wert);
    if ($wert >= 1)   return round($wert * 2) / 2;
    return round($wert, 2);
}

/**
 * Sucht das Sinnbild zur Zutat, sonst das des Bereichs.
 *
 * Kurze Stichwörter zählen nur als ganzes Wort — sonst bekäme Basmatireis das
 * Ei-Sinnbild, wie es beim Bereich schon einmal passiert ist.
 */
function laden_sinnbild_raten(string $name, string $bereich): string
{
    $n = laden_name_normalisieren($name);

    foreach (ZUTAT_SINNBILDER as $bild => $woerter) {
        foreach ($woerter as $wort) {
            $treffer = mb_strlen($wort) <= 3
                ? (bool) preg_match('/(?:^|\s)' . preg_quote($wort, '/') . '(?:\s|$)/u', $n)
                : str_contains($n, $wort);
            if ($treffer) {
                return $bild;
            }
        }
    }

    return BEREICH_SINNBILDER[$bereich] ?? BEREICH_SINNBILDER['other'];
}

function einkauf_posten_ausgeben(array $z): array
{
    return [
        'id'            => $z['id'],
        'name'          => $z['name'],
        // Selbst gewählt schlägt geraten.
        'icon'          => ($z['icon'] ?? null) ?: laden_sinnbild_raten($z['name'], $z['store_category']),
        // Ein eigenes Bild tritt an die Stelle des geratenen Sinnbilds.
        'imageUrl'      => $z['image_url'] ?? null,
        'quantity'      => $z['quantity'] === null ? null : (float) $z['quantity'],
        'unit'          => $z['unit'],
        'storeCategory' => $z['store_category'],
        'perishable'    => in_array($z['store_category'], FRISCHE_BEREICHE, true),
        'perishing'     => $stufe = haltbarkeit_raten($z['name']),
        'perishingNote' => haltbarkeit_hinweis($stufe),
        'daysAhead'     => $z['needed_by_date'] === null
            ? null
            : (int) floor((strtotime($z['needed_by_date']) - strtotime(date('Y-m-d'))) / 86400),
        'storeId'       => $z['store_id'],
        'storeName'     => $z['store_name'] ?? null,
        'sourceType'    => $z['source_type'],
        'status'        => $z['status'],
        'neededByDate'  => $z['needed_by_date'],
        // Alle Termine, an denen der Posten gebraucht wird – je Termin mit dem
        // eigenen Grund, falls dort nicht eingekauft werden kann. Ein Grund für
        // den ganzen Posten wäre falsch: Der eine Termin kann ein Sonntag sein,
        // der andere ein Feiertag.
        'neededDates'   => array_map(
            static function (string $d) use ($z): array {
                $k = einkauf_kauftag($d, $z['land'] ?? FEIERTAG_STANDARD_LAND);
                return ['date' => $d, 'reason' => $k['reason'], 'buyBy' => $k['date']];
            },
            $z['needed_dates'] ?? [],
        ),
        'doneAt'        => $z['done_at'],
        'fromRecipes'   => $z['from_recipes'] ?? [],
    ];
}

/**
 * Sammelt die Zutaten aller bestätigten Plan-Einträge eines Zeitraums,
 * skaliert auf die geplanten Portionen.
 *
 * Zusammengefasst wird über den vereinheitlichten Zutatenschlüssel plus
 * Einheit: "rote Zwiebeln, 2 Stück" und "Zwiebeln, 3 Stück" ergeben einen
 * Posten mit 5 Stück. Verschiedene Einheiten bleiben getrennt – 200 g Tomaten
 * und 3 Stück Tomaten lassen sich nicht seriös addieren.
 */
function einkauf_bedarf_sammeln(string $userId, string $von, int $tage): array
{
    $bis = date('Y-m-d', strtotime("$von +" . ($tage - 1) . ' days'));

    $eintraege = query(
        "SELECT pe.id, pe.recipe_id, pe.portion_count, pe.eat_date,
                r.title AS recipe_title, r.servings
           FROM plan_entries pe
           JOIN recipes r ON r.id = pe.recipe_id AND r.deleted_at IS NULL
          WHERE pe.user_id = ? AND pe.eat_date BETWEEN ? AND ?
            AND pe.status = 'confirmed' AND pe.is_absent = 0",
        [$userId, $von, $bis],
    );

    if (!$eintraege) {
        return [];
    }

    $bedarf = [];
    foreach ($eintraege as $e) {
        $portionen = max(0.25, (float) $e['portion_count']);
        $basis = max(1, (int) $e['servings']);

        $zutaten = query(
            'SELECT name, name_key, amount, unit FROM ingredients
              WHERE recipe_id = ? ORDER BY position ASC',
            [$e['recipe_id']],
        );

        foreach ($zutaten as $z) {
            $einheit = $z['unit'] ?? '';
            $schluessel = $z['name_key'] . '|' . $einheit;

            $menge = $z['amount'] === null
                ? null
                : ((float) $z['amount'] / $basis) * $portionen;

            if (!isset($bedarf[$schluessel])) {
                $bedarf[$schluessel] = [
                    'name'     => $z['name'],
                    'nameKey'  => $z['name_key'],
                    'unit'     => $z['unit'],
                    'quantity' => null,
                    'entries'  => [],
                    'dates'     => [],
                    'entryDates' => [],
                    'recipes'  => [],
                    'firstDate' => $e['eat_date'],
                ];
            }

            if ($menge !== null) {
                $bedarf[$schluessel]['quantity'] =
                    ($bedarf[$schluessel]['quantity'] ?? 0) + $menge;
            }

            $bedarf[$schluessel]['entries'][$e['id']] =
                ($bedarf[$schluessel]['entries'][$e['id']] ?? 0) + ($menge ?? 0);

            // Je Essenstermin getrennt merken: Braucht man Hackfleisch am
            // Montag und am Samstag, sollen beide Tage auf der Liste stehen,
            // statt zu einem Posten ohne Datum zu verschmelzen.
            $bedarf[$schluessel]['dates'][$e['eat_date']] =
                ($bedarf[$schluessel]['dates'][$e['eat_date']] ?? 0) + ($menge ?? 0);
            $bedarf[$schluessel]['entryDates'][$e['id']] = $e['eat_date'];

            $bedarf[$schluessel]['recipes'][$e['recipe_title']] = true;

            if ($e['eat_date'] < $bedarf[$schluessel]['firstDate']) {
                $bedarf[$schluessel]['firstDate'] = $e['eat_date'];
            }
        }
    }

    return $bedarf;
}

/**
 * Prüft, was der Vorrat davon schon abdeckt.
 *
 * Verglichen wird nur bei <strong>gleicher Einheit</strong>: "500 g Mehl" im
 * Vorrat deckt "200 g Mehl" im Rezept, aber "4 Portionen Quinoasalat" sagt
 * nichts über "250 g Quinoa" aus. Lieber einmal zu viel einkaufen als ein
 * Rezept ohne Zutat.
 *
 * Vorgekochte Mahlzeiten braucht dieser Vergleich ohnehin nicht: Ein
 * Plan-Eintrag aus dem Vorrat hat kein Rezept und liefert deshalb gar keine
 * Zutaten – der Abgleich geschieht dort schon eine Ebene höher.
 */
function einkauf_vorrat_abgleichen(string $userId, array $bedarf): array
{
    $vorrat = query(
        'SELECT name, name_key, quantity, unit FROM stock_items WHERE user_id = ?',
        [$userId],
    );

    $nachSchluessel = [];
    foreach ($vorrat as $v) {
        $k = $v['name_key'] . '|' . ($v['unit'] ?? '');
        $nachSchluessel[$k] = ($nachSchluessel[$k] ?? 0) + (float) $v['quantity'];
        $nachSchluessel[$k . '#name'] = $v['name'];
    }

    $gedeckt = [];
    foreach ($bedarf as $k => $b) {
        $da = $nachSchluessel[$k] ?? 0;
        if ($da <= 0 || $b['quantity'] === null) {
            continue;
        }

        $rest = $b['quantity'] - $da;
        $gedeckt[$k] = [
            'name'       => $b['name'],
            'needed'     => einkauf_runden($b['quantity']),
            'inStock'    => $da,
            'unit'       => $b['unit'],
            'stockName'  => $nachSchluessel[$k . '#name'] ?? $b['name'],
            'fully'      => $rest <= 0,
            'remaining'  => $rest > 0 ? einkauf_runden($rest) : null,
            'recipes'    => array_keys($b['recipes']),
        ];
    }

    return $gedeckt;
}

/**
 * Schreibt den gesammelten Bedarf in die Liste.
 *
 * Aus dem Plan erzeugte Posten werden dabei neu aufgebaut, von Hand
 * hinzugefügte bleiben unangetastet — sonst verschwände beim nächsten Lauf,
 * was jemand selbst eingetragen hat. Schon erledigte Posten bleiben ebenfalls
 * stehen: Was im Wagen liegt, gehört nicht noch einmal auf die Liste.
 *
 * $ausnahmen sind Schlüssel, die trotz Vorrat auf die Liste sollen — der
 * Klick auf einen ausgegrauten Posten landet hier.
 */
function einkauf_erzeugen(string $userId, string $von, int $tage, array $ausnahmen = []): array
{
    $bedarf = einkauf_bedarf_sammeln($userId, $von, $tage);
    $gedeckt = einkauf_vorrat_abgleichen($userId, $bedarf);

    // Offene Posten aus dem Plan wegräumen; die Beiträge gehen per Kaskade mit.
    execute(
        "DELETE FROM shopping_list_items
          WHERE user_id = ? AND source_type = 'recipe' AND status = 'open'",
        [$userId],
    );

    // Was schon abgehakt ist, liegt im Wagen und gehört nicht noch einmal auf
    // die Liste – auch dann nicht, wenn der Plan es weiterhin verlangt.
    $imWagen = [];
    foreach (query(
        "SELECT name_key, unit FROM shopping_list_items
          WHERE user_id = ? AND status = 'done'",
        [$userId],
    ) as $z) {
        $imWagen[$z['name_key'] . '|' . ($z['unit'] ?? '')] = true;
    }

    $angelegt = 0;
    $uebersprungen = 0;

    $schonGekauft = 0;

    foreach ($bedarf as $schluessel => $b) {
        if (isset($imWagen[$schluessel])) {
            $schonGekauft++;
            continue;
        }

        $deckung = $gedeckt[$schluessel] ?? null;

        // Vollständig im Vorrat und nicht ausdrücklich angefordert: überspringen.
        if ($deckung !== null && $deckung['fully'] && !in_array($schluessel, $ausnahmen, true)) {
            $uebersprungen++;
            continue;
        }

        // Teilweise gedeckt: nur die Differenz einkaufen.
        $menge = $b['quantity'];
        if ($deckung !== null && !$deckung['fully'] && !in_array($schluessel, $ausnahmen, true)) {
            $menge = $deckung['remaining'];
        }

        $bereich = laden_bereich_raten($b['name']);
        $stufe = haltbarkeit_raten($b['name']);

        // Verderbliches wird je Termin einzeln gekauft: Hackfleisch für Montag
        // und für Samstag sind zwei Einkäufe, kein größerer. Haltbares wird zu
        // einem Posten zusammengefasst; die Termine stehen trotzdem daran.
        $einzeln = $stufe === HALTBAR_SOFORT || $stufe === HALTBAR_SCHNELL;

        if ($einzeln && count($b['dates']) > 1) {
            foreach ($b['dates'] as $datum => $teilmenge) {
                // Anteil der Deckung anteilig auf die Termine verteilen.
                $anteilMenge = $menge === null || $b['quantity'] === null || $b['quantity'] <= 0
                    ? $teilmenge
                    : $menge * ($teilmenge / $b['quantity']);

                $id = new_id();
                execute(
                    'INSERT INTO shopping_list_items
                        (id, user_id, name, name_key, quantity, unit, store_category,
                         source_type, status, needed_by_date)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        $id, $userId, $b['name'], $b['nameKey'],
                        einkauf_runden($anteilMenge), $b['unit'], $bereich,
                        'recipe', 'open', $datum,
                    ],
                );
                einkauf_beitraege_schreiben($id, $b, $datum);
                $angelegt++;
            }
            continue;
        }

        $id = new_id();
        execute(
            'INSERT INTO shopping_list_items
                (id, user_id, name, name_key, quantity, unit, store_category,
                 source_type, status, needed_by_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $id, $userId, $b['name'], $b['nameKey'],
                einkauf_runden($menge), $b['unit'], $bereich,
                'recipe', 'open', $b['firstDate'],
            ],
        );
        einkauf_beitraege_schreiben($id, $b, null);

        $angelegt++;
    }

    return [
        'created'       => $angelegt,
        'covered'       => array_values($gedeckt),
        'skipped'       => $uebersprungen,
        'alreadyBought' => $schonGekauft,
    ];
}

/**
 * Schreibt die Beiträge eines Postens.
 *
 * $nurDatum begrenzt auf die Plan-Einträge eines bestimmten Essenstermins –
 * gebraucht, wenn ein verderblicher Posten je Termin einzeln gekauft wird.
 */
function einkauf_beitraege_schreiben(string $itemId, array $b, ?string $nurDatum): void
{
    foreach ($b['entries'] as $eintragId => $anteil) {
        if ($nurDatum !== null && ($b['entryDates'][$eintragId] ?? null) !== $nurDatum) {
            continue;
        }
        execute(
            'INSERT INTO shopping_list_contributions (id, item_id, plan_entry_id, quantity, unit)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)',
            [new_id(), $itemId, $eintragId, $anteil, $b['unit']],
        );
    }
}

/**
 * Zieht den Anteil eines Plan-Eintrags wieder ab.
 *
 * Wird aufgerufen, wenn ein Eintrag aus dem Plan verschwindet. Ein Posten, von
 * dem nichts übrig bleibt, fliegt ganz raus; teilt er sich mit anderen
 * Rezepten, schrumpft er nur.
 *
 * <strong>Schon Gekauftes wandert in den Vorrat</strong>, statt einfach zu
 * verschwinden: Wer die Zwiebeln für ein Rezept schon im Haus hat und das
 * Rezept dann streicht, hat die Zwiebeln trotzdem noch. Abgebucht wird genau
 * der Anteil dieses Eintrags — teilt sich der Posten mit einem anderen Rezept,
 * bleibt dessen Teil auf der Liste.
 *
 * Gibt zurück, was in den Vorrat gebucht wurde, damit die Oberfläche es sagen
 * kann.
 */
function einkauf_beitrag_entfernen(string $planEntryId, string $userId): array
{
    $beitraege = query(
        "SELECT c.id, c.item_id, c.quantity, c.unit AS beitrag_einheit,
                i.quantity AS gesamt, i.status, i.name, i.name_key, i.unit
           FROM shopping_list_contributions c
           JOIN shopping_list_items i ON i.id = c.item_id
          WHERE c.plan_entry_id = ? AND i.user_id = ?",
        [$planEntryId, $userId],
    );

    $inDenVorrat = [];

    foreach ($beitraege as $b) {
        execute('DELETE FROM shopping_list_contributions WHERE id = ?', [$b['id']]);

        if ($b['status'] === 'done') {
            $menge = einkauf_runden((float) $b['quantity']);
            if ($menge !== null && $menge > 0) {
                vorrat_zubuchen($userId, [
                    'name'       => $b['name'],
                    'nameKey'    => $b['name_key'],
                    'quantity'   => $menge,
                    'unit'       => $b['unit'] ?: 'g',
                    'location'   => 'Vorratsschrank',
                    'recipeId'   => null,
                    'bestBefore' => null,
                    // Gekaufte Zutaten sind Zutaten, kein fertiges Essen.
                    'kind'          => VORRAT_ART_ZUTAT,
                    'storeCategory' => laden_bereich_raten($b['name']),
                ]);
                $inDenVorrat[] = [
                    'name'     => $b['name'],
                    'quantity' => $menge,
                    'unit'     => $b['unit'],
                ];
            }
            continue;
        }

        // Bleibt noch ein anderer Beitrag übrig? Dann nur abziehen.
        $rest = query_one(
            'SELECT COUNT(*) AS anzahl, COALESCE(SUM(quantity), 0) AS summe
               FROM shopping_list_contributions WHERE item_id = ?',
            [$b['item_id']],
        );

        if ((int) $rest['anzahl'] === 0) {
            execute('DELETE FROM shopping_list_items WHERE id = ?', [$b['item_id']]);
        } elseif ($b['gesamt'] !== null) {
            execute(
                'UPDATE shopping_list_items SET quantity = ? WHERE id = ?',
                [einkauf_runden((float) $rest['summe']), $b['item_id']],
            );
        }
    }

    return $inDenVorrat;
}

/** Prüft die Eingaben für einen Posten von Hand. */
function einkauf_eingaben(): array
{
    $b = body();

    $name = trim((string) ($b['name'] ?? ''));
    if ($name === '') {
        fail('Bitte gib an, was gekauft werden soll.');
    }

    $menge = isset($b['quantity']) && $b['quantity'] !== '' && $b['quantity'] !== null
        ? (float) $b['quantity']
        : null;
    if ($menge !== null && ($menge <= 0 || $menge > 99999)) {
        fail('Die Menge muss größer als 0 sein.');
    }

    $bereich = (string) ($b['storeCategory'] ?? '');
    if (!in_array($bereich, LADEN_BEREICHE, true)) {
        $bereich = laden_bereich_raten($name);
    }

    $datum = trim((string) ($b['neededByDate'] ?? ''));
    if ($datum !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $datum)) {
        fail('Das Datum sieht nicht nach einem Datum aus.');
    }

    $ladenId = trim((string) ($b['storeId'] ?? '')) ?: null;

    // Ein leerer String entfernt das Bild, ein fehlendes Feld lässt es stehen.
    $bild = array_key_exists('imageUrl', $b)
        ? (trim((string) ($b['imageUrl'] ?? '')) ?: null)
        : false;

    // Dasselbe für das Sinnbild: leer heißt "wieder raten lassen".
    $sinnbild = array_key_exists('icon', $b)
        ? (mb_substr(trim((string) ($b['icon'] ?? '')), 0, 8) ?: null)
        : false;

    return [
        'storeId'       => $ladenId,
        'imageUrl'      => $bild,
        'icon'          => $sinnbild,
        'name'          => mb_substr($name, 0, 191),
        'nameKey'       => zutaten_schluessel($name),
        'quantity'      => $menge,
        'unit'          => trim((string) ($b['unit'] ?? '')) ?: null,
        'storeCategory' => $bereich,
        'neededByDate'  => $datum ?: null,
    ];
}
