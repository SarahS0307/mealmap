<?php
/**
 * Nachträgliche Schemaänderungen für Datenbanken, die es schon gibt.
 *
 * schema.sql legt Tabellen nur an, wenn sie fehlen – neue Spalten in
 * bestehenden Tabellen erreicht es also nicht. Diese Datei holt das nach und
 * lässt sich beliebig oft ausführen: Jeder Schritt prüft erst, ob er nötig ist.
 *
 * Wird von migrate.php mit aufgerufen.
 */

/** Legt eine Spalte an, falls sie noch fehlt. */
function spalte_ergaenzen(PDO $pdo, string $tabelle, string $spalte, string $definition): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    );
    $stmt->execute([$tabelle, $spalte]);

    if ((int) $stmt->fetchColumn() > 0) {
        return false;
    }

    $pdo->exec("ALTER TABLE `$tabelle` ADD COLUMN `$spalte` $definition");
    return true;
}

/** Legt einen Index an, falls er noch fehlt. */
function index_ergaenzen(PDO $pdo, string $tabelle, string $name, string $spalten): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.statistics
          WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?',
    );
    $stmt->execute([$tabelle, $name]);

    if ((int) $stmt->fetchColumn() > 0) {
        return false;
    }

    $pdo->exec("ALTER TABLE `$tabelle` ADD INDEX `$name` ($spalten)");
    return true;
}

function upgrades_ausfuehren(PDO $pdo): array
{
    $ausgefuehrt = [];

    if (spalte_ergaenzen($pdo, 'recipes', 'deleted_at', 'DATETIME NULL DEFAULT NULL')) {
        $ausgefuehrt[] = 'recipes.deleted_at angelegt (Papierkorb)';
    }
    if (index_ergaenzen($pdo, 'recipes', 'idx_recipes_deleted', '`deleted_at`')) {
        $ausgefuehrt[] = 'Index auf recipes.deleted_at angelegt';
    }

    if (spalte_ergaenzen($pdo, 'users', 'state', "VARCHAR(2) NOT NULL DEFAULT 'BW'")) {
        $ausgefuehrt[] = 'users.state angelegt (Bundesland für die Feiertage)';
    }

    if (spalte_ergaenzen($pdo, 'users', 'habits', 'TEXT NULL DEFAULT NULL')) {
        $ausgefuehrt[] = 'users.habits angelegt (persönliche Gewohnheiten als Freitext)';
    }

    if (spalte_ergaenzen($pdo, 'plan_entries', 'guest_count', 'INT NOT NULL DEFAULT 0')) {
        $ausgefuehrt[] = 'plan_entries.guest_count angelegt (weitere Esser ohne Namen)';
    }

    return $ausgefuehrt;
}
