<?php
/**
 * Einstiegspunkt der MealMap-API.
 *
 * Alle Anfragen unter /api landen hier (siehe .htaccess) und werden anhand von
 * Methode und Pfad an die passende Funktion weitergereicht.
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';

apply_cors();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Pfad hinter /api ermitteln, unabhängig davon, in welchem Verzeichnis die
// Anwendung liegt (lokal /MealMap/api, live /api).
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
$position = strpos($path, '/api');
$route = $position === false ? $path : substr($path, $position + 4);
$route = '/' . trim($route, '/');

require_once __DIR__ . '/routes/session.php';
require_once __DIR__ . '/routes/user.php';

switch ("$method $route") {
    case 'GET /':
        send_json(['name' => 'MealMap API', 'status' => 'ok']);

    case 'GET /session':
        route_session_show();

    case 'POST /session':
        route_session_create();

    case 'DELETE /session':
        route_session_destroy();

    case 'GET /users':
        route_users_index();

    case 'PATCH /user':
        route_user_update();

    case 'PUT /user/api-key':
        route_user_api_key();

    default:
        fail('Unbekannter Endpunkt: ' . $method . ' ' . $route, 404);
}
