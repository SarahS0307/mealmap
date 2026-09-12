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
require_once __DIR__ . '/routes/categories.php';
require_once __DIR__ . '/routes/recipes.php';

/**
 * Zerlegt Pfade mit einer Kennung, etwa /recipes/abc123 oder
 * /recipes/abc123/rating. Gibt Muster und Kennung zurück.
 */
$id = '';
$muster = $route;
if (preg_match('#^/(recipes|categories)/([A-Za-z0-9_-]+)(/[a-z-]+)?$#', $route, $treffer)) {
    $id = $treffer[2];
    $muster = '/' . $treffer[1] . '/{id}' . ($treffer[3] ?? '');
}

switch ("$method $muster") {
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

    case 'GET /categories':
        route_categories_index();

    case 'POST /categories':
        route_categories_create();

    case 'PATCH /categories/{id}':
        route_categories_update($id);

    case 'DELETE /categories/{id}':
        route_categories_delete($id);

    case 'GET /recipes':
        route_recipes_index();

    case 'POST /recipes':
        route_recipes_create();

    case 'GET /recipes/{id}':
        route_recipes_show($id);

    case 'PATCH /recipes/{id}':
        route_recipes_update($id);

    case 'PUT /recipes/{id}/rating':
        route_recipes_rate($id);

    case 'POST /recipes/{id}/adjust':
        route_recipes_adjust($id);

    case 'DELETE /recipes/{id}':
        route_recipes_delete($id);

    default:
        fail('Unbekannter Endpunkt: ' . $method . ' ' . $route, 404);
}
