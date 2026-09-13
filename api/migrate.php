<?php
/**
 * Legt die Datenbankstruktur an. Läuft nur über die Kommandozeile, nie über den
 * Browser – die .htaccess sperrt den Web-Zugriff zusätzlich.
 *
 * Lokal:  php api/migrate.php
 * Live:   schema.sql über phpMyAdmin einspielen (Strato bietet phpMyAdmin an)
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Nur über die Kommandozeile ausführbar.\n");
}

require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/upgrades.php';

$sql = file_get_contents(__DIR__ . '/schema.sql');
if ($sql === false) {
    exit("schema.sql nicht lesbar.\n");
}

$pdo = db();
/**
 * In Anweisungen zerlegen. Kommentarzeilen werden je Anweisung entfernt statt
 * die ganze Anweisung zu verwerfen – sonst fallen Tabellen weg, denen ein
 * erklärender Kommentar vorausgeht.
 */
$statements = [];
foreach (explode(';', $sql) as $chunk) {
    $lines = array_filter(
        array_map('trim', explode("\n", $chunk)),
        static fn(string $line): bool => $line !== '' && !str_starts_with($line, '--'),
    );
    $statement = trim(implode("\n", $lines));
    if ($statement !== '') {
        $statements[] = $statement;
    }
}

$count = 0;
foreach ($statements as $statement) {
    $pdo->exec($statement);
    if (stripos($statement, 'CREATE TABLE') !== false) {
        $count++;
    }
}

echo "Struktur angelegt. Tabellen: $count\n";

$upgrades = upgrades_ausfuehren($pdo);
if ($upgrades !== []) {
    echo "Nachträgliche Änderungen:\n";
    foreach ($upgrades as $u) {
        echo "  $u\n";
    }
} else {
    echo "Keine nachträglichen Änderungen nötig.\n";
}

$tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
echo "In der Datenbank: " . implode(', ', $tables) . "\n";
