<?php
/**
 * Nutzerverwaltung ohne Passwort.
 *
 * Der Name identifiziert den Nutzer, die Zuordnung merkt sich eine PHP-Session.
 * Jede Entität hängt an einer user_id, die Datenbestände sind dadurch getrennt.
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/feiertage.php';

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $config = config();
    $istHttps = ($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off';

    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 365,
        'path'     => '/',
        'httponly' => true,
        // Lax genügt auch in der Entwicklung: Oberfläche und API laufen zwar auf
        // verschiedenen Ports, gelten aber als dieselbe Site. SameSite=None wäre
        // hier falsch – Browser verlangen dafür zwingend HTTPS.
        'samesite' => 'Lax',
        'secure'   => $istHttps,
    ]);
    session_name('mealmap');
    session_start();
}

function current_user(): ?array
{
    start_session();
    $userId = $_SESSION['user_id'] ?? null;
    if (!$userId) {
        return null;
    }
    return query_one('SELECT id, name, api_key, state, habits FROM users WHERE id = ?', [$userId]);
}

/** Wie current_user, bricht aber mit 401 ab, wenn niemand angemeldet ist. */
function require_user(): array
{
    $user = current_user();
    if (!$user) {
        fail('Nicht angemeldet.', 401);
    }
    return $user;
}

function set_current_user(string $userId): void
{
    start_session();
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
}

function clear_current_user(): void
{
    start_session();
    $_SESSION = [];
    session_destroy();
}

/**
 * Gibt den Nutzer nach außen – ohne den API-Schlüssel. Der bleibt auf dem
 * Server; der Browser erfährt nur, ob einer hinterlegt ist.
 */
function public_user(array $user): array
{
    return [
        'id'        => $user['id'],
        'name'      => $user['name'],
        'hasApiKey' => !empty($user['api_key']),
        'state'     => $user['state'] ?? FEIERTAG_STANDARD_LAND,
        'habits'    => $user['habits'] ?? null,
    ];
}

/**
 * Einfacher Schutz gegen automatisiertes Durchprobieren: begrenzt die
 * Anmeldeversuche je Absender. Reicht für eine private App; ein echter
 * Angreifer mit vielen Adressen wird damit nicht aufgehalten.
 */
function check_rate_limit(string $bucket, int $maxAttempts = 10, int $windowSeconds = 300): void
{
    start_session();
    $now = time();
    $key = 'rate_' . $bucket;
    $entry = $_SESSION[$key] ?? ['count' => 0, 'start' => $now];

    if ($now - $entry['start'] > $windowSeconds) {
        $entry = ['count' => 0, 'start' => $now];
    }

    $entry['count']++;
    $_SESSION[$key] = $entry;

    if ($entry['count'] > $maxAttempts) {
        fail('Zu viele Versuche. Bitte warte ein paar Minuten.', 429);
    }
}
