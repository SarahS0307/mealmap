<?php
/**
 * Vorschlagsmotor für den Plan – immer eine Woche auf einmal.
 *
 * Zwei Betriebsarten:
 *
 *   Ohne hinterlegte Gewohnheiten läuft eine schlichte Rotation: freie Mittag-
 *   und Abendslots werden mit Rezepten gefüllt, gekocht wird am selben Tag.
 *   Bewusst ohne Annahmen darüber, wann jemand auswärts isst oder frühstückt –
 *   das ist bei jeder Person anders und gehört nicht in den Code.
 *
 *   Mit Gewohnheiten (Einstellungen, Freitext) und hinterlegtem API-Schlüssel
 *   liest die KI den Text und verteilt die Mahlzeiten danach: sie darf Slots
 *   freilassen, Abwesenheiten setzen und Kochtermine vorziehen, etwa für Meal
 *   Prep. Was dabei herauskommt, sind Vorschläge wie sonst auch und muss
 *   bestätigt werden.
 *
 * Unangetastet bleibt in beiden Fällen, was schon geplant ist.
 */

require_once __DIR__ . '/plan.php';
require_once __DIR__ . '/feiertage.php';
require_once __DIR__ . '/claude.php';
require_once __DIR__ . '/stock.php';

/** Nur diese Slots werden automatisch belegt, wenn keine Gewohnheiten vorliegen. */
const VORSCHLAG_SLOTS = ['lunch', 'dinner'];

/** Alle Slots – die KI darf frei wählen. */
const VORSCHLAG_SLOTS_ALLE = ['breakfast', 'snack_am', 'lunch', 'snack_pm', 'dinner', 'other'];

/** Der Sonntag am oder vor dem Datum. Nur als Hilfe für die KI gedacht. */
function vorschlag_kochsonntag(string $datum): string
{
    $wt = (int) date('N', strtotime($datum));
    return $wt === 7 ? $datum : date('Y-m-d', strtotime("$datum -$wt days"));
}

/**
 * Rezepte der Sammlung, sortiert danach, was am längsten nicht dran war.
 *
 * Zuerst kommt, was noch nie oder lange nicht geplant war; bei Gleichstand
 * entscheidet die Bewertung. So dreht sich die Sammlung durch, statt immer
 * dieselben zwei Gerichte vorzuschlagen.
 */
function vorschlag_kandidaten(string $userId): array
{
    return query(
        'SELECT r.id, r.title, r.servings, r.rating, r.prep_minutes, r.freezable,
                MAX(pe.eat_date) AS zuletzt
           FROM recipes r
           LEFT JOIN plan_entries pe
                  ON pe.recipe_id = r.id AND pe.user_id = r.user_id
          WHERE r.user_id = ? AND r.deleted_at IS NULL
          GROUP BY r.id, r.title, r.servings, r.rating, r.prep_minutes, r.freezable
          ORDER BY (MAX(pe.eat_date) IS NULL) DESC,
                   MAX(pe.eat_date) ASC,
                   r.rating DESC,
                   r.title ASC',
        [$userId],
    );
}

/** Welche Slots an welchen Tagen noch frei sind. */
function vorschlag_freie_slots(string $userId, string $von, int $tage, array $slots): array
{
    $bis = date('Y-m-d', strtotime("$von +" . ($tage - 1) . ' days'));

    $belegt = [];
    foreach (query(
        'SELECT eat_date, meal_slot FROM plan_entries
          WHERE user_id = ? AND eat_date BETWEEN ? AND ?',
        [$userId, $von, $bis],
    ) as $e) {
        $belegt[$e['eat_date'] . '|' . $e['meal_slot']] = true;
    }

    $frei = [];
    for ($i = 0; $i < $tage; $i++) {
        $datum = date('Y-m-d', strtotime("$von +$i days"));
        foreach ($slots as $slot) {
            if (!isset($belegt["$datum|$slot"])) {
                $frei[] = ['date' => $datum, 'slot' => $slot];
            }
        }
    }
    return $frei;
}

/**
 * Was im Vorrat liegt und noch nicht verplant ist – Reste zuerst.
 *
 * Abgezogen wird, was in schon geplanten Mahlzeiten steckt, aber noch nicht
 * abgebucht ist: sonst würde derselbe Rest zweimal eingeplant.
 */
function vorschlag_vorrat_verfuegbar(string $userId): array
{
    $posten = query(
        'SELECT s.id, s.name, s.quantity, s.unit, s.best_before,
                COALESCE(SUM(CASE WHEN pes.consumed_at IS NULL THEN pes.portions END), 0) AS verplant
           FROM stock_items s
           LEFT JOIN plan_entry_stock pes ON pes.stock_item_id = s.id
          WHERE s.user_id = ?
          GROUP BY s.id, s.name, s.quantity, s.unit, s.best_before
          ORDER BY (s.best_before IS NULL) ASC, s.best_before ASC, s.created_at ASC',
        [$userId],
    );

    $frei = [];
    foreach ($posten as $p) {
        $rest = (float) $p['quantity'] - (float) $p['verplant'];
        if ($rest > 0) {
            $p['frei'] = $rest;
            $frei[] = $p;
        }
    }
    return $frei;
}

/**
 * Schlichte Rotation ohne Annahmen: jeder freie Mittag- und Abendslot bekommt
 * etwas, gekocht wird am selben Tag. Mittags und abends landet nie dasselbe.
 *
 * <strong>Reste zuerst:</strong> Was im Vorrat liegt, wird vor dem Kochen
 * verplant – und davon zuerst, was am ehesten abläuft. Erst wenn der Vorrat
 * aufgebraucht ist, kommen Rezepte an die Reihe.
 */
function vorschlag_einfach(string $userId, string $von, int $tage): array
{
    $rezepte = vorschlag_kandidaten($userId);
    $reste = vorschlag_vorrat_verfuegbar($userId);
    if (!$rezepte && !$reste) {
        return [];
    }

    $frei = vorschlag_freie_slots($userId, $von, $tage, VORSCHLAG_SLOTS);
    $anzahl = count($rezepte);
    $proTag = [];
    $naechstes = 0;
    $neu = [];

    foreach ($frei as $platz) {
        $datum = $platz['date'];

        // Zuerst der Vorrat. Eine Portion je Mahlzeit – mehr anzunehmen wäre
        // geraten; wer mehr braucht, stellt es im Eintrag um.
        $rest = null;
        foreach ($reste as $i => $r) {
            if ($r['frei'] >= 1 && !isset($proTag[$datum]['v' . $r['id']])) {
                $rest = $r;
                $reste[$i]['frei'] = $r['frei'] - 1;
                break;
            }
        }
        if ($rest !== null) {
            $proTag[$datum]['v' . $rest['id']] = true;
            $neu[] = [
                'eatDate'      => $datum,
                'cookDate'     => null,
                'mealSlot'     => $platz['slot'],
                'recipeId'     => null,
                'freeText'     => null,
                'portionCount' => 1,
                'forWhom'      => ['Ich'],
                'guestCount'   => 0,
                'status'       => 'suggested',
                'isAbsent'     => 0,
                'fromStock'    => [['stockItemId' => $rest['id'], 'portions' => 1]],
            ];
            continue;
        }

        if (!$rezepte) {
            continue;
        }

        $gericht = null;
        for ($versuch = 0; $versuch < $anzahl; $versuch++) {
            $k = $rezepte[($naechstes + $versuch) % $anzahl];
            if (!isset($proTag[$datum][$k['id']])) {
                $gericht = $k;
                $naechstes += $versuch + 1;
                break;
            }
        }
        // Bei sehr kleiner Sammlung lässt sich die Doppelung nicht vermeiden;
        // dann gewinnt "überhaupt ein Vorschlag".
        if ($gericht === null) {
            $gericht = $rezepte[$naechstes % $anzahl];
            $naechstes++;
        }

        $proTag[$datum][$gericht['id']] = true;
        $neu[] = [
            'fromStock'    => null,
            'eatDate'      => $datum,
            'cookDate'     => $datum,
            'mealSlot'     => $platz['slot'],
            'recipeId'     => $gericht['id'],
            'freeText'     => null,
            'portionCount' => 1,
            'forWhom'      => ['Ich'],
            'guestCount'   => 0,
            'status'       => 'suggested',
            'isAbsent'     => 0,
        ];
    }

    return $neu;
}

/**
 * Tage, an denen schon Abwesenheit eingetragen ist – auch über die geplante
 * Woche hinaus.
 *
 * Wichtig für das Vorkochen: Ist jemand ein Wochenende weg, kommt er dann
 * nicht zum Kochen und braucht vorher etwas im Gefrierschrank. Die Folgewoche
 * gehört deshalb mit in den Blick.
 */
function vorschlag_abwesenheiten(string $userId, string $von, int $tage): array
{
    $bis = date('Y-m-d', strtotime("$von +" . ($tage + 6) . ' days'));

    $zeilen = query(
        'SELECT eat_date, meal_slot FROM plan_entries
          WHERE user_id = ? AND is_absent = 1 AND eat_date BETWEEN ? AND ?
          ORDER BY eat_date ASC',
        [$userId, $von, $bis],
    );

    $nach = [];
    foreach ($zeilen as $z) {
        $nach[$z['eat_date']][] = $z['meal_slot'];
    }

    $liste = [];
    foreach ($nach as $datum => $slots) {
        $liste[] = ['date' => $datum, 'slots' => $slots];
    }
    return $liste;
}

/** Antwortform, die von der KI zurückkommen soll. */
function vorschlag_schema(): array
{
    return [
        'type'       => 'object',
        'properties' => [
            'entries' => [
                'type'  => 'array',
                'items' => [
                    'type'       => 'object',
                    'properties' => [
                        'eatDate'  => ['type' => 'string', 'description' => 'Essenstermin, JJJJ-MM-TT'],
                        'cookDate' => ['type' => 'string', 'description' => 'Kochtermin, JJJJ-MM-TT. Gleich dem Essenstermin, außer es wird vorgekocht.'],
                        'mealSlot' => ['type' => 'string', 'enum' => VORSCHLAG_SLOTS_ALLE],
                        'recipeId' => ['type' => ['string', 'null'], 'description' => 'Kennung aus der Rezeptliste. Null, wenn nichts gegessen wird.'],
                        'isAbsent' => ['type' => 'boolean', 'description' => 'Wahr, wenn zu dieser Mahlzeit nichts zuhause gegessen wird.'],
                        'portionCount' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 20],
                    ],
                    'required'             => ['eatDate', 'cookDate', 'mealSlot', 'recipeId', 'isAbsent', 'portionCount'],
                    'additionalProperties' => false,
                ],
            ],
        ],
        'required'             => ['entries'],
        'additionalProperties' => false,
    ];
}

function vorschlag_anweisung(): string
{
    return <<<TEXT
    Du planst Mahlzeiten für eine Woche. Du bekommst die Tage, die noch freien
    Slots, die Rezeptsammlung und die persönlichen Gewohnheiten der Person.

    Halte dich an diese Regeln:
    - Nimm ausschließlich Rezepte aus der übergebenen Liste, über ihre Kennung.
    - Belege nur Slots, die als frei übergeben wurden. Erfinde keine dazu.
    - Du musst nicht jeden freien Slot belegen. Wenn die Gewohnheiten sagen,
      dass zu einer Mahlzeit nichts zuhause gegessen wird, setze isAbsent auf
      wahr und recipeId auf null.
    - Die Gewohnheiten haben Vorrang vor deinem eigenen Empfinden, was üblich
      ist. Sie sind die einzige Quelle dafür, wie diese Person lebt.
    - Wird vorgekocht (Meal Prep), setze cookDate auf den Kochtag und eatDate
      auf den Tag, an dem gegessen wird. Sonst sind beide gleich.
    - cookDate darf nie nach eatDate liegen.
    - Wiederhole ein Gericht nicht am selben Tag zu zwei Mahlzeiten.
    - Achte auf Abwechslung über die Woche, bevorzuge aber gut bewertete
      Rezepte und solche, die lange nicht dran waren.
    - Unter inStock steht, was schon vorgekocht im Vorrat liegt. Plane diese
      Tage sparsam mit neuen Rezepten – wer vier Portionen im Gefrierschrank
      hat, braucht nicht jeden Tag zu kochen. Zuordnen kannst du den Vorrat
      nicht selbst; lass solche Slots lieber frei.
    - Unter absences stehen Tage, an denen die Person schon als abwesend
      eingetragen ist – auch in der Woche danach. An solchen Tagen wird nicht
      gekocht. Plane deshalb <em>davor</em> größere Portionen ein, damit
      danach etwas da ist: cookDate auf einen Tag vor der Abwesenheit,
      portionCount entsprechend höher. Sag das nicht dazu, plane es einfach.
    TEXT;
}

/**
 * Lässt die KI die Woche planen, anhand der hinterlegten Gewohnheiten.
 *
 * Gibt null zurück, wenn kein Schlüssel oder kein Gewohnheitstext vorliegt –
 * dann übernimmt die einfache Rotation.
 */
function vorschlag_mit_ki(array $user, string $von, int $tage): ?array
{
    $gewohnheiten = trim((string) ($user['habits'] ?? ''));
    $schluessel = (string) ($user['api_key'] ?? '');

    if ($gewohnheiten === '' || $schluessel === '') {
        return null;
    }

    $rezepte = vorschlag_kandidaten($user['id']);
    $frei = vorschlag_freie_slots($user['id'], $von, $tage, VORSCHLAG_SLOTS_ALLE);
    if (!$rezepte || !$frei) {
        return [];
    }

    $land = $user['state'] ?? FEIERTAG_STANDARD_LAND;
    $wochentage = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

    // Tatsachen über die Tage – Wochentag und Feiertag. Was daraus folgt,
    // steht ausschließlich in den Gewohnheiten.
    $tagesliste = [];
    for ($i = 0; $i < $tage; $i++) {
        $datum = date('Y-m-d', strtotime("$von +$i days"));
        $feiertag = feiertag_name($datum, $land);
        $tagesliste[] = [
            'date'      => $datum,
            'weekday'   => $wochentage[(int) date('N', strtotime($datum))],
            'holiday'   => $feiertag,
            'lastSunday' => vorschlag_kochsonntag($datum),
        ];
    }

    $eingabe = [
        'days'        => $tagesliste,
        'freeSlots'   => $frei,
        'recipes'     => array_map(static fn (array $r): array => [
            'id'          => $r['id'],
            'title'       => $r['title'],
            'servings'    => (int) $r['servings'],
            'rating'      => $r['rating'] === null ? null : (int) $r['rating'],
            'prepMinutes' => $r['prep_minutes'] === null ? null : (int) $r['prep_minutes'],
            'freezable'   => (bool) $r['freezable'],
            'lastPlanned' => $r['zuletzt'],
        ], $rezepte),
        'habits'      => $gewohnheiten,
        // Reste zuerst: Was da ist, soll verplant werden, bevor neu gekocht
        // wird. Die KI kann es aber nicht selbst zuweisen – sie darf es nur
        // als freeText benennen, verbucht wird nichts. Deshalb nur als Hinweis.
        // Wo schon Abwesenheit steht – auch in der Folgewoche. Wer weg ist,
        // kocht nicht und braucht vorher etwas im Gefrierschrank.
        'absences'    => vorschlag_abwesenheiten($user['id'], $von, $tage),
        'inStock'     => array_map(static fn (array $r): array => [
            'name'       => $r['name'],
            'portions'   => (float) $r['frei'],
            'bestBefore' => $r['best_before'],
        ], vorschlag_vorrat_verfuegbar($user['id'])),
    ];

    $antwort = claude_json(
        $schluessel,
        vorschlag_anweisung(),
        [['type' => 'text', 'text' => json_encode($eingabe, JSON_UNESCAPED_UNICODE)]],
        vorschlag_schema(),
        'entries',
        4000,
    );

    return vorschlag_antwort_pruefen($antwort, $frei, $rezepte);
}

/**
 * Prüft, was die KI zurückgegeben hat.
 *
 * Alles, was nicht zu einem freien Slot oder einem vorhandenen Rezept passt,
 * fliegt raus – die Antwort eines Sprachmodells ist eine Behauptung, kein
 * Befehl. Lieber ein Vorschlag weniger als ein kaputter Eintrag.
 */
function vorschlag_antwort_pruefen(array $antwort, array $frei, array $rezepte): array
{
    $erlaubt = [];
    foreach ($frei as $p) {
        $erlaubt[$p['date'] . '|' . $p['slot']] = true;
    }
    $bekannt = [];
    foreach ($rezepte as $r) {
        $bekannt[$r['id']] = true;
    }

    $neu = [];
    $gesehen = [];

    foreach ($antwort as $e) {
        $essen = plan_datum($e['eatDate'] ?? null);
        $slot  = (string) ($e['mealSlot'] ?? '');
        if ($essen === null || !isset($erlaubt["$essen|$slot"])) {
            continue;
        }
        // Denselben Slot nur einmal belegen.
        if (isset($gesehen["$essen|$slot"])) {
            continue;
        }

        $abwesend = !empty($e['isAbsent']);
        $rezeptId = $e['recipeId'] ?? null;

        if (!$abwesend) {
            if (!is_string($rezeptId) || !isset($bekannt[$rezeptId])) {
                continue;
            }
        } else {
            $rezeptId = null;
        }

        $kochen = plan_datum($e['cookDate'] ?? null) ?? $essen;
        if ($kochen > $essen) {
            $kochen = $essen;
        }

        $portionen = (int) ($e['portionCount'] ?? 1);
        if ($portionen < 1 || $portionen > 20) {
            $portionen = 1;
        }

        $gesehen["$essen|$slot"] = true;
        $neu[] = [
            'fromStock'    => null,
            'eatDate'      => $essen,
            'cookDate'     => $abwesend ? null : $kochen,
            'mealSlot'     => $slot,
            'recipeId'     => $rezeptId,
            'freeText'     => null,
            'portionCount' => $portionen,
            'forWhom'      => ['Ich'],
            'guestCount'   => 0,
            'status'       => 'suggested',
            'isAbsent'     => $abwesend ? 1 : 0,
        ];
    }

    return $neu;
}

/**
 * Stellt die Vorschläge für eine Woche zusammen, ohne sie zu speichern.
 * Nimmt den Weg über die KI, wenn Gewohnheiten und Schlüssel vorliegen.
 */
function vorschlag_woche(array $user, string $von, int $tage): array
{
    $ausKi = vorschlag_mit_ki($user, $von, $tage);
    if ($ausKi !== null) {
        return $ausKi;
    }
    return vorschlag_einfach($user['id'], $von, $tage);
}
