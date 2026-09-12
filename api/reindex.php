<?php
/**
 * Berechnet die Zutatenschlüssel aller Rezepte neu.
 *
 * Der Schlüssel wird beim Speichern eines Rezepts festgeschrieben. Ändern sich
 * die Regeln in lib/ingredients.php, tragen ältere Rezepte noch die alten
 * Schlüssel – dann fasst die Einkaufsliste falsch zusammen. Dieses Skript zieht
 * sie nach.
 *
 * Aufruf: npm run db:reindex
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Nur über die Kommandozeile ausführbar.\n");
}

require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/ingredients.php';

$geaendert = 0;
$gesamt = 0;

foreach ([['ingredients', 'Zutaten'], ['stock_items', 'Vorrat'], ['shopping_list_items', 'Einkaufsliste']] as [$tabelle, $bezeichnung]) {
    $zeilen = query("SELECT id, name, name_key FROM $tabelle");
    foreach ($zeilen as $zeile) {
        $gesamt++;
        $neu = zutaten_schluessel($zeile['name']);
        if ($neu !== $zeile['name_key']) {
            execute("UPDATE $tabelle SET name_key = ? WHERE id = ?", [$neu, $zeile['id']]);
            echo sprintf("  %-16s %-22s %s -> %s\n", $bezeichnung, $zeile['name'], $zeile['name_key'], $neu);
            $geaendert++;
        }
    }
}

echo "\n$gesamt Einträge geprüft, $geaendert angepasst.\n";
