<?php
/** Kleine Helfer für JSON-Antworten und Anfrage-Auswertung. */

/**
 * Zeitzone für PHP festlegen.
 *
 * Ohne Angabe läuft PHP auf UTC, MySQL aber auf der Systemzeit des Servers.
 * Jede Datumsrechnung, die beide mischt, wäre dann um Stunden daneben – beim
 * Papierkorb um einen Tag, beim Meal-Prep-Plan um einen ganzen Termin.
 */
function zeitzone_setzen(): void
{
    static $gesetzt = false;
    if ($gesetzt) {
        return;
    }
    date_default_timezone_set(config()['timezone'] ?? 'Europe/Berlin');
    $gesetzt = true;
}

function config(): array
{
    static $config = null;
    if ($config === null) {
        $path = __DIR__ . '/../config.php';
        if (!file_exists($path)) {
            send_json(['error' => 'api/config.php fehlt. Vorlage kopieren: cp api/config.example.php api/config.php'], 500);
        }
        $config = require $path;
    }
    return $config;
}

/** Erlaubt dem Next-Entwicklungsserver den Zugriff – nur im Entwicklungsmodus. */
function apply_cors(): void
{
    $config = config();
    if (($config['env'] ?? 'prod') !== 'dev') {
        return;
    }

    // Im Entwicklungsmodus zählen mehrere Herkünfte: der Next-Server auf 3000,
    // der BrowserSync-Proxy auf 3001 und dieselben Ports über die Netzwerk-IP,
    // damit auch das Handy die API erreicht.
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $erlaubt = $config['dev_origins'] ?? [];
    $passt = in_array($origin, $erlaubt, true)
        || (bool) preg_match('#^http://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}):(3000|3001)$#', $origin);

    if ($passt) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    }

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function send_json(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $status = 400): never
{
    send_json(['error' => $message], $status);
}

/** Liest den JSON-Rumpf der Anfrage. */
function body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function body_string(string $key, int $maxLength = 255): string
{
    $value = body()[$key] ?? '';
    if (!is_string($value)) {
        return '';
    }
    return mb_substr(trim($value), 0, $maxLength);
}

/** Erzeugt eine zufällige, eindeutige ID. */
function new_id(): string
{
    return bin2hex(random_bytes(16));
}
