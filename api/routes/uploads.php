<?php
/** Dateien entgegennehmen und Bilder an Rezepte hängen. */

require_once __DIR__ . '/../lib/uploads.php';

/**
 * Nimmt eine Datei entgegen und gibt ihre Adresse zurück.
 * Das Zuordnen zu einem Rezept passiert getrennt davon.
 */
function route_uploads_create(): never
{
    require_user();
    send_json(['file' => upload_entgegennehmen()], 201);
}

/** Hängt ein bereits hochgeladenes Bild an ein Rezept. */
function route_recipe_images_create(string $recipeId): never
{
    $user = require_user();

    $rezept = query_one(
        'SELECT id FROM recipes WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        [$recipeId, $user['id']],
    );
    if (!$rezept) {
        fail('Dieses Rezept gibt es nicht.', 404);
    }

    $url = body_string('url', 500);
    if ($url === '') {
        fail('Es fehlt die Adresse des Bildes.');
    }

    $position = (int) (query_one(
        'SELECT COALESCE(MAX(position), -1) + 1 AS n FROM recipe_images WHERE recipe_id = ?',
        [$recipeId],
    )['n']);

    $id = new_id();
    execute(
        'INSERT INTO recipe_images (id, recipe_id, url, position) VALUES (?, ?, ?, ?)',
        [$id, $recipeId, $url, $position],
    );

    send_json(['image' => ['id' => $id, 'url' => $url, 'position' => $position]], 201);
}

/** Entfernt ein Bild vom Rezept und löscht die Datei. */
function route_recipe_images_delete(string $recipeId, string $imageId): never
{
    $user = require_user();

    $bild = query_one(
        'SELECT ri.id, ri.url FROM recipe_images ri
           JOIN recipes r ON r.id = ri.recipe_id
          WHERE ri.id = ? AND ri.recipe_id = ? AND r.user_id = ?',
        [$imageId, $recipeId, $user['id']],
    );
    if (!$bild) {
        fail('Dieses Bild gibt es nicht.', 404);
    }

    execute('DELETE FROM recipe_images WHERE id = ?', [$imageId]);
    upload_loeschen($bild['url']);

    send_json(['deleted' => true]);
}
