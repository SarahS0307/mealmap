<?php
/** Datenbankverbindung über PDO. */

require_once __DIR__ . '/http.php';

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $db = config()['db'];
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $db['host'],
        $db['port'],
        $db['name'],
    );

    try {
        $pdo = new PDO($dsn, $db['user'], $db['password'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        // Die echte Fehlermeldung enthält Zugangsdaten und bleibt im Log.
        error_log('MealMap: Datenbankverbindung fehlgeschlagen: ' . $e->getMessage());
        fail('Keine Verbindung zur Datenbank.', 500);
    }

    return $pdo;
}

/** Führt eine Abfrage aus und gibt alle Zeilen zurück. */
function query(string $sql, array $params = []): array
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

/** Führt eine Abfrage aus und gibt die erste Zeile zurück, sonst null. */
function query_one(string $sql, array $params = []): ?array
{
    $rows = query($sql, $params);
    return $rows[0] ?? null;
}

function execute(string $sql, array $params = []): int
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->rowCount();
}
