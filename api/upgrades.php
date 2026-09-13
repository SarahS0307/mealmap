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

/**
 * Ändert den Typ einer Spalte, falls er noch nicht passt.
 *
 * Verglichen wird der Anfang des Typs, damit "decimal(10,2)" auch dann als
 * erledigt gilt, wenn MySQL es anders schreibt als wir.
 */
function spalte_typ_aendern(PDO $pdo, string $tabelle, string $spalte, string $definition): bool
{
    $stmt = $pdo->prepare(
        'SELECT column_type FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    );
    $stmt->execute([$tabelle, $spalte]);
    $jetzt = $stmt->fetchColumn();

    if ($jetzt === false) {
        return false;
    }

    $soll = strtolower(strtok($definition, ' '));
    if (str_starts_with(strtolower((string) $jetzt), $soll)) {
        return false;
    }

    $pdo->exec("ALTER TABLE `$tabelle` MODIFY COLUMN `$spalte` $definition");
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

    if (spalte_typ_aendern($pdo, 'plan_entries', 'portion_count', 'DECIMAL(10,2) NOT NULL DEFAULT 1')) {
        $ausgefuehrt[] = 'plan_entries.portion_count auf halbe Portionen umgestellt';
    }

    if (spalte_ergaenzen($pdo, 'shopping_list_items', 'store_id', 'VARCHAR(36) NULL DEFAULT NULL')) {
        $ausgefuehrt[] = 'shopping_list_items.store_id angelegt (optionaler Laden)';
    }

    if (spalte_ergaenzen($pdo, 'shopping_list_items', 'image_url', 'TEXT NULL DEFAULT NULL')) {
        $ausgefuehrt[] = 'shopping_list_items.image_url angelegt (eigenes Bild am Posten)';
    }

    if (spalte_ergaenzen($pdo, 'shopping_list_items', 'icon', 'VARCHAR(16) NULL DEFAULT NULL')) {
        $ausgefuehrt[] = 'shopping_list_items.icon angelegt (selbst gewähltes Sinnbild)';
    }

    if (spalte_ergaenzen($pdo, 'stock_items', 'kind', "VARCHAR(16) NOT NULL DEFAULT 'ingredient'")) {
        $ausgefuehrt[] = 'stock_items.kind angelegt (gekochtes Essen oder reine Zutat)';
    }
    if (spalte_ergaenzen($pdo, 'stock_items', 'store_category', "VARCHAR(32) NOT NULL DEFAULT 'other'")) {
        $ausgefuehrt[] = 'stock_items.store_category angelegt (Kategorie im Vorrat)';
    }

    // Altbestand einordnen: Posten, die aus einem Rezept stammen oder in
    // Portionen gezählt werden, sind fertiges Essen; alles andere Zutat. Die
    // Kategorie wird einmalig aus dem Namen geraten.
    $offen = (int) $pdo->query(
        "SELECT COUNT(*) FROM stock_items WHERE store_category = 'other'"
    )->fetchColumn();

    if ($offen > 0) {
        require_once __DIR__ . '/lib/laden.php';

        $pdo->exec(
            "UPDATE stock_items
                SET kind = 'cooked'
              WHERE recipe_id IS NOT NULL OR unit = 'Portion'"
        );

        $stmt = $pdo->query("SELECT id, name FROM stock_items WHERE store_category = 'other'");
        $setzen = $pdo->prepare('UPDATE stock_items SET store_category = ? WHERE id = ?');
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $z) {
            $setzen->execute([laden_bereich_raten($z['name']), $z['id']]);
        }

        $ausgefuehrt[] = "Vorratsposten eingeordnet: $offen Stück nachgetragen";
    }

    return $ausgefuehrt;
}
