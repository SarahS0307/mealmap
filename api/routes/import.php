<?php
/**
 * Rezept-Import aus Text, Bild, PDF oder Link.
 *
 * Zweistufig wie überall in MealMap: Erst wird gelesen und angezeigt, was
 * erkannt wurde, erst danach gespeichert. Nichts landet ungefragt in der
 * Sammlung.
 *
 * Ohne hinterlegten Schlüssel meldet der Import das ehrlich zurück, statt
 * still zu scheitern – die manuelle Eingabe bleibt immer offen.
 */

require_once __DIR__ . '/../lib/claude.php';
require_once __DIR__ . '/../lib/uploads.php';
require_once __DIR__ . '/../lib/ingredients.php';

/** Gibt Auskunft, ob der Import benutzbar ist. */
function route_import_status(): never
{
    $user = require_user();
    send_json([
        'available' => !empty($user['api_key']),
        'reason'    => empty($user['api_key'])
            ? 'Es ist kein Schlüssel hinterlegt. Du kannst Rezepte weiterhin von Hand eingeben.'
            : null,
    ]);
}

/** Holt den Schlüssel oder bricht mit einer verständlichen Meldung ab. */
function import_schluessel(array $user): string
{
    if (empty($user['api_key'])) {
        fail(
            'Für den Import wird ein Schlüssel gebraucht. Du kannst ihn in den '
            . 'Einstellungen hinterlegen – oder das Rezept von Hand eingeben.',
            409,
        );
    }
    return $user['api_key'];
}

/** Lädt eine Webseite und gibt ihren Text zurück. */
function webseite_lesen(string $url): string
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_USERAGENT      => 'MealMap/1.0 (Rezept-Import)',
    ]);
    $inhalt = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($inhalt === false || $status >= 400) {
        fail('Die Seite ließ sich nicht laden (Status ' . $status . ').', 502);
    }

    // Skripte und Formatierung entfernen, der Text genügt.
    $inhalt = preg_replace('#<(script|style|nav|footer|header)\b[^>]*>.*?</\1>#is', ' ', $inhalt) ?? $inhalt;
    $text = trim(html_entity_decode(strip_tags($inhalt), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    $text = preg_replace('/[ \t]+/', ' ', $text) ?? $text;
    $text = preg_replace('/\n{3,}/', "\n\n", $text) ?? $text;

    if (mb_strlen($text) < 50) {
        fail('Auf der Seite war kein lesbarer Text zu finden.', 422);
    }

    // Sehr lange Seiten beschneiden – Rezepte stehen fast immer oben.
    return mb_substr($text, 0, 60000);
}

/**
 * Liest Rezepte aus einer Quelle und gibt sie zurück, ohne zu speichern.
 *
 * Erwartet eines von: text, url, uploadUrl (Bild oder PDF aus /uploads).
 */
function route_import_read(): never
{
    $user = require_user();
    $schluessel = import_schluessel($user);
    $b = body();

    $inhalte = [];
    $quelle = null;

    if (!empty($b['text'])) {
        $text = trim((string) $b['text']);
        if (mb_strlen($text) < 20) {
            fail('Der Text ist zu kurz, um ein Rezept zu enthalten.');
        }
        $inhalte[] = ['type' => 'text', 'text' => "Lies die Rezepte aus diesem Text:\n\n" . mb_substr($text, 0, 60000)];
    } elseif (!empty($b['url'])) {
        $url = trim((string) $b['url']);
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            fail('Das sieht nicht nach einem Link aus.');
        }
        $quelle = $url;
        $text = webseite_lesen($url);
        $inhalte[] = ['type' => 'text', 'text' => "Lies die Rezepte aus dem Inhalt dieser Seite ($url):\n\n" . $text];
    } elseif (!empty($b['uploadUrl'])) {
        $dateiname = basename(parse_url((string) $b['uploadUrl'], PHP_URL_PATH) ?? '');
        $pfad = upload_pfad($dateiname);
        if ($pfad === null) {
            fail('Die hochgeladene Datei wurde nicht gefunden.', 404);
        }

        $typ = (new finfo(FILEINFO_MIME_TYPE))->file($pfad) ?: '';
        $daten = base64_encode((string) file_get_contents($pfad));

        if ($typ === 'application/pdf') {
            $inhalte[] = [
                'type'   => 'document',
                'source' => ['type' => 'base64', 'media_type' => 'application/pdf', 'data' => $daten],
            ];
        } else {
            $inhalte[] = [
                'type'   => 'image',
                'source' => ['type' => 'base64', 'media_type' => $typ, 'data' => $daten],
            ];
        }
        $inhalte[] = ['type' => 'text', 'text' => 'Lies die Rezepte aus dieser Datei.'];
    } else {
        fail('Es fehlt die Quelle: Text, Link oder hochgeladene Datei.');
    }

    $rezepte = claude_rezepte_lesen($schluessel, $inhalte);

    // Vorhandene Kategorien mitschicken, damit die Oberfläche Vorschläge
    // zuordnen kann statt Doppelungen anzulegen.
    $vorhanden = query(
        'SELECT id, name FROM categories WHERE user_id = ? ORDER BY name ASC',
        [$user['id']],
    );

    send_json([
        'recipes'           => $rezepte,
        'sourceUrl'         => $quelle,
        'existingCategories'=> $vorhanden,
        'count'             => count($rezepte),
    ]);
}
