<?php
/**
 * Hilfsfunktionen für den Meal-Prep-Plan.
 *
 * Datumsangaben laufen durchgehend als YYYY-MM-DD durch die API. Gerechnet
 * wird, wo es geht, in SQL – PHP und MySQL haben unterschiedliche Uhren, wenn
 * die Zeitzone nicht überall gleich gesetzt ist.
 */

require_once __DIR__ . '/stock.php';

const PLAN_SLOTS = ['breakfast', 'snack_am', 'lunch', 'snack_pm', 'dinner', 'other'];
const PLAN_STATUS = ['suggested', 'confirmed'];

/** Prüft ein Datum und gibt es normalisiert zurück, sonst null. */
function plan_datum(mixed $wert): ?string
{
    if (!is_string($wert) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $wert)) {
        return null;
    }
    [$j, $m, $t] = array_map('intval', explode('-', $wert));
    return checkdate($m, $t, $j) ? $wert : null;
}

/** Legt den Tagesdatensatz an, falls er noch fehlt, und gibt seine Kennung zurück. */
function plan_tag_sicherstellen(string $userId, string $datum): string
{
    $vorhanden = query_one(
        'SELECT id FROM plan_days WHERE user_id = ? AND date = ?',
        [$userId, $datum],
    );
    if ($vorhanden) {
        return $vorhanden['id'];
    }

    $id = new_id();
    execute(
        'INSERT INTO plan_days (id, user_id, date) VALUES (?, ?, ?)',
        [$id, $userId, $datum],
    );
    return $id;
}

/** Liest und prüft die Eingaben für einen Plan-Eintrag. */
function plan_eingaben(): array
{
    $b = body();

    $essen = plan_datum($b['eatDate'] ?? null);
    if ($essen === null) {
        fail('Es fehlt ein gültiges Essensdatum.');
    }

    // Der Kochtermin darf fehlen (dann wird nicht selbst gekocht) und darf
    // vor dem Essenstermin liegen – genau dafür ist er da.
    $kochen = isset($b['cookDate']) && $b['cookDate'] !== null && $b['cookDate'] !== ''
        ? plan_datum($b['cookDate'])
        : null;
    if (isset($b['cookDate']) && $b['cookDate'] !== null && $b['cookDate'] !== '' && $kochen === null) {
        fail('Das Kochdatum ist ungültig.');
    }
    if ($kochen !== null && $kochen > $essen) {
        fail('Gekocht wird nicht nach dem Essen. Bitte Kochtermin auf oder vor den Essenstermin legen.');
    }

    $slot = (string) ($b['mealSlot'] ?? '');
    if (!in_array($slot, PLAN_SLOTS, true)) {
        fail('Unbekannter Mahlzeiten-Slot.');
    }

    $rezeptId = trim((string) ($b['recipeId'] ?? '')) ?: null;
    $freitext = trim((string) ($b['freeText'] ?? '')) ?: null;
    $abwesend = !empty($b['isAbsent']);

    // Eine Mahlzeit kann auch allein aus Vorratsposten bestehen – etwa
    // "1 Portion Reis, 1 Portion Hackfleisch, 1 Portion Salsasoße". Dann gibt
    // es kein Rezept und keinen Freitext, und das ist in Ordnung.
    $ausVorrat = is_array($b['fromStock'] ?? null) ? $b['fromStock'] : null;

    // Ein Eintrag braucht einen Inhalt – außer er markiert Abwesenheit.
    // Vorratsposten zählen dabei als Inhalt.
    if (!$abwesend && $rezeptId === null && $freitext === null && !$ausVorrat) {
        fail('Wähle ein Rezept, nimm etwas aus dem Vorrat oder schreibe etwas hinein.');
    }

    if ($rezeptId !== null) {
        $user = require_user();
        $eigenes = query_one(
            'SELECT id FROM recipes WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
            [$rezeptId, $user['id']],
        );
        if (!$eigenes) {
            fail('Dieses Rezept gibt es nicht.', 404);
        }
    }

    $portionen = (int) ($b['portionCount'] ?? 1);
    if ($portionen < 1 || $portionen > 99) {
        fail('Die Portionszahl muss zwischen 1 und 99 liegen.');
    }

    $fuerWen = is_array($b['forWhom'] ?? null) ? $b['forWhom'] : ['Ich'];

    // Namenlose Mitesser, etwa Besuch. Bewusst getrennt von den Namen: eine
    // Anzahl ist keine Liste, und später sollen die Namen aus dem Haushalt
    // kommen, während die Anzahl frei bleibt.
    $gaeste = (int) ($b['guestCount'] ?? 0);
    if ($gaeste < 0 || $gaeste > 99) {
        fail('Die Zahl weiterer Personen muss zwischen 0 und 99 liegen.');
    }
    $fuerWen = array_values(array_filter(array_map(
        static fn($n): string => mb_substr(trim((string) $n), 0, 40),
        $fuerWen,
    )));
    if ($fuerWen === []) {
        $fuerWen = ['Ich'];
    }

    $status = (string) ($b['status'] ?? 'confirmed');
    if (!in_array($status, PLAN_STATUS, true)) {
        $status = 'confirmed';
    }

    return [
        'eatDate'      => $essen,
        'cookDate'     => $kochen,
        'mealSlot'     => $slot,
        'recipeId'     => $rezeptId,
        'freeText'     => $freitext,
        'portionCount' => $portionen,
        'forWhom'      => $fuerWen,
        'guestCount'   => $gaeste,
        'fromStock'    => $ausVorrat,
        'status'       => $status,
        'isAbsent'     => $abwesend ? 1 : 0,
    ];
}

/** Bringt eine Datenbankzeile in die Form, die die Oberfläche erwartet. */
/**
 * Formt eine Datenbankzeile für die Ausgabe.
 *
 * $vorrat ist die vorab geladene Zuordnung Eintrag => Vorratsposten. Ohne sie
 * wird für diesen einen Eintrag nachgefragt – das ist für Einzelabrufe in
 * Ordnung, für Listen aber nicht: dort würde je Eintrag eine Abfrage anfallen.
 * Die Listenansicht lädt deshalb einmal für den ganzen Zeitraum, siehe
 * vorrat_zu_eintraegen().
 */
function plan_eintrag_ausgeben(array $z, ?array $vorrat = null): array
{
    return [
        'id'           => $z['id'],
        'cookDate'     => $z['cook_date'],
        'eatDate'      => $z['eat_date'],
        'mealSlot'     => $z['meal_slot'],
        'recipeId'     => $z['recipe_id'],
        'recipeTitle'  => $z['recipe_title'] ?? null,
        'freeText'     => $z['free_text'],
        'portionCount' => (int) $z['portion_count'],
        'forWhom'      => json_decode((string) $z['for_whom'], true) ?: ['Ich'],
        'guestCount'   => (int) ($z['guest_count'] ?? 0),
        'fromStock'    => $vorrat !== null
            ? ($vorrat[$z['id']] ?? [])
            : vorrat_zu_eintrag($z['id'], $z['user_id']),
        'status'       => $z['status'],
        'isAbsent'     => (bool) $z['is_absent'],
        'cookedAt'     => $z['cooked_at'],
        'eatenAt'      => $z['eaten_at'],
    ];
}

function plan_eintrag_laden(string $id, string $userId): ?array
{
    $z = query_one(
        'SELECT pe.*, r.title AS recipe_title
           FROM plan_entries pe
           LEFT JOIN recipes r ON r.id = pe.recipe_id AND r.deleted_at IS NULL
          WHERE pe.id = ? AND pe.user_id = ?',
        [$id, $userId],
    );
    return $z ? plan_eintrag_ausgeben($z) : null;
}
