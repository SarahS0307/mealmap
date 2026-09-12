<?php
/** Anmeldung, Abmeldung und Abfrage des aktuellen Nutzers. */

function route_session_show(): never
{
    $user = current_user();
    send_json(['user' => $user ? public_user($user) : null]);
}

function route_session_create(): never
{
    check_rate_limit('signin');

    $name = body_string('name', 40);
    if ($name === '') {
        fail('Bitte gib einen Namen ein.');
    }

    $config = config();
    $existing = query_one('SELECT id, name, api_key FROM users WHERE name = ?', [$name]);

    if (!$existing) {
        // Live sollen nur hinterlegte Namen durchkommen. Während der Entwicklung
        // steht closed_signup auf false, damit Testnutzer entstehen können.
        if (!empty($config['closed_signup'])) {
            $erlaubt = array_map('mb_strtolower', $config['allowed_names'] ?? []);
            if (!in_array(mb_strtolower($name), $erlaubt, true)) {
                fail('Diesen Namen kenne ich nicht.', 403);
            }
        }

        $id = new_id();
        execute('INSERT INTO users (id, name) VALUES (?, ?)', [$id, $name]);
        $existing = query_one('SELECT id, name, api_key FROM users WHERE id = ?', [$id]);
    }

    set_current_user($existing['id']);
    send_json(['user' => public_user($existing)]);
}

function route_session_destroy(): never
{
    clear_current_user();
    send_json(['user' => null]);
}
