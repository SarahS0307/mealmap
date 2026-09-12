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
    send_json(['user' => public_user(['id' => $user['id'], 'name' => $name, 'api_key' => $user['api_key']])]);
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
