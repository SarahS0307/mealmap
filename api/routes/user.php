<?php
/** Nutzerliste, Namensänderung und der Schlüssel für den KI-Import. */

function route_users_index(): never
{
    $rows = query('SELECT id, name FROM users ORDER BY name ASC');
    send_json(['users' => $rows]);
}

function route_user_update(): never
{
    $user = require_user();
    $name = body_string('name', 40);

    if ($name === '') {
        fail('Bitte gib einen Namen ein.');
    }

    $taken = query_one('SELECT id FROM users WHERE name = ? AND id <> ?', [$name, $user['id']]);
    if ($taken) {
        fail('Diesen Namen benutzt bereits jemand anderes.', 409);
    }

    execute('UPDATE users SET name = ? WHERE id = ?', [$name, $user['id']]);
    send_json(['user' => public_user([
        'id'      => $user['id'],
        'name'    => $name,
        'api_key' => $user['api_key'],
        'state'   => $user['state'] ?? FEIERTAG_STANDARD_LAND,
    ])]);
}

/**
 * Speichert das Bundesland. Es entscheidet, welche Feiertage gelten – und
 * damit, an welchen Tagen eingekauft werden kann und wann Sarah mittags
 * daheim ist.
 */
function route_user_state(): never
{
    $user = require_user();
    $land = strtoupper(trim((string) (body()['state'] ?? '')));

    if (!bundesland_gueltig($land)) {
        fail('Dieses Bundesland kenne ich nicht.', 422);
    }

    execute('UPDATE users SET state = ? WHERE id = ?', [$land, $user['id']]);
    send_json(['user' => public_user([
        'id'      => $user['id'],
        'name'    => $user['name'],
        'api_key' => $user['api_key'],
        'state'   => $land,
    ])]);
}

/**
 * Speichert die persönlichen Gewohnheiten als Freitext.
 *
 * Bewusst ohne Struktur: wann jemand auswärts isst, was er nicht mag, welcher
 * Kochrhythmus passt – das ist bei jeder Person anders und lässt sich nicht
 * sinnvoll in Felder pressen. Der Text geht beim Vorschlagen an die KI.
 */
function route_user_habits(): never
{
    $user = require_user();
    $text = trim((string) (body()['habits'] ?? ''));

    if (mb_strlen($text) > 4000) {
        fail('Das ist zu lang – bitte auf 4000 Zeichen kürzen.', 422);
    }

    execute('UPDATE users SET habits = ? WHERE id = ?', [$text ?: null, $user['id']]);
    send_json(['user' => public_user([
        'id'      => $user['id'],
        'name'    => $user['name'],
        'api_key' => $user['api_key'],
        'state'   => $user['state'] ?? FEIERTAG_STANDARD_LAND,
        'habits'  => $text ?: null,
    ])]);
}

/** Die Auswahlliste für die Einstellungen. */
function route_states_index(): never
{
    $liste = [];
    foreach (BUNDESLAENDER as $kuerzel => $name) {
        $liste[] = ['code' => $kuerzel, 'name' => $name];
    }
    send_json(['states' => $liste]);
}

/**
 * Speichert den Schlüssel für den KI-Import. Ein leerer Wert entfernt ihn.
 * Der Schlüssel wird nie zurückgegeben – der Browser erfährt nur, ob einer da ist.
 */
function route_user_api_key(): never
{
    $user = require_user();
    $raw = body_string('apiKey', 400);
    $value = $raw === '' ? null : $raw;

    execute('UPDATE users SET api_key = ? WHERE id = ?', [$value, $user['id']]);
    send_json(['hasApiKey' => $value !== null]);
}
