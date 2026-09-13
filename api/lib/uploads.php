<?php
/**
 * Entgegennahme von Bildern und PDFs.
 *
 * Die Dateien landen in einem Ordner außerhalb des gebauten Bündels – dist/
 * entsteht bei jedem Bau neu, Uploads würden dort verschwinden.
 *
 * Geprüft wird der tatsächliche Inhalt, nicht die Dateiendung: Ein als .jpg
 * benanntes PHP-Skript wäre sonst eine Einladung. Der Dateiname wird ohnehin
 * neu vergeben, der ursprüngliche fließt nirgends ein.
 */

require_once __DIR__ . '/http.php';

const UPLOAD_MAX_BYTES = 12 * 1024 * 1024;

/** Erlaubte Inhaltstypen und die Endung, unter der gespeichert wird. */
const UPLOAD_TYPEN = [
    'image/jpeg'      => 'jpg',
    'image/png'       => 'png',
    'image/webp'      => 'webp',
    'image/heic'      => 'heic',
    'image/heif'      => 'heif',
    'application/pdf' => 'pdf',
];

function upload_verzeichnis(): string
{
    $pfad = config()['uploads_dir'] ?? (__DIR__ . '/../../uploads');
    if (!is_dir($pfad) && !mkdir($pfad, 0775, true) && !is_dir($pfad)) {
        fail('Der Upload-Ordner lässt sich nicht anlegen.', 500);
    }
    return rtrim($pfad, '/');
}

function upload_basis_url(): string
{
    return rtrim(config()['uploads_url'] ?? '/uploads', '/');
}

/**
 * Nimmt eine hochgeladene Datei entgegen und gibt Adresse und Art zurück.
 * Erwartet das Feld `file` aus einem multipart-Formular.
 */
function upload_entgegennehmen(string $feld = 'file'): array
{
    if (!isset($_FILES[$feld])) {
        fail('Es wurde keine Datei mitgeschickt.');
    }

    $datei = $_FILES[$feld];

    if (($datei['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        fail(match ($datei['error']) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Die Datei ist zu groß.',
            UPLOAD_ERR_PARTIAL   => 'Die Datei kam nur teilweise an. Bitte noch einmal versuchen.',
            UPLOAD_ERR_NO_FILE   => 'Es wurde keine Datei ausgewählt.',
            default              => 'Der Upload ist fehlgeschlagen.',
        });
    }

    if ($datei['size'] > UPLOAD_MAX_BYTES) {
        fail('Die Datei ist größer als ' . (UPLOAD_MAX_BYTES / 1024 / 1024) . ' MB.');
    }

    // Inhalt prüfen, nicht die Endung.
    $typ = (new finfo(FILEINFO_MIME_TYPE))->file($datei['tmp_name']) ?: '';
    if (!isset(UPLOAD_TYPEN[$typ])) {
        fail('Nur Bilder (JPEG, PNG, WebP, HEIC) und PDFs sind erlaubt. Erkannt: ' . $typ);
    }

    $endung = UPLOAD_TYPEN[$typ];
    $name = bin2hex(random_bytes(16)) . '.' . $endung;
    $ziel = upload_verzeichnis() . '/' . $name;

    if (!move_uploaded_file($datei['tmp_name'], $ziel)) {
        fail('Die Datei konnte nicht gespeichert werden.', 500);
    }
    chmod($ziel, 0644);

    return [
        'url'      => upload_basis_url() . '/' . $name,
        'dateiname'=> $name,
        'mimeType' => $typ,
        'art'      => $typ === 'application/pdf' ? 'pdf' : 'bild',
        'groesse'  => (int) $datei['size'],
    ];
}

/** Absoluter Pfad zu einer hochgeladenen Datei – nur innerhalb des Ordners. */
function upload_pfad(string $dateiname): ?string
{
    // Keine Pfadanteile zulassen, damit niemand aus dem Ordner ausbricht.
    if (!preg_match('/^[a-f0-9]{32}\.[a-z]{3,4}$/', $dateiname)) {
        return null;
    }
    $pfad = upload_verzeichnis() . '/' . $dateiname;
    return is_file($pfad) ? $pfad : null;
}

/** Löscht eine hochgeladene Datei, wenn sie zum Ordner gehört. */
function upload_loeschen(string $url): void
{
    $dateiname = basename(parse_url($url, PHP_URL_PATH) ?? '');
    $pfad = upload_pfad($dateiname);
    if ($pfad !== null) {
        @unlink($pfad);
    }
}
