<?php
/**
 * Papierkorb für Rezepte.
 *
 * Gelöschte Rezepte verschwinden nicht sofort, sondern bekommen einen Zeitstempel
 * in `deleted_at`. Bis zum Ablauf der Frist lassen sie sich wiederherstellen,
 * danach räumt die App sie selbst weg.
 *
 * Auf klassischem Webspace gibt es keine geplanten Aufgaben, deshalb wird beim
 * Zugriff aufgeräumt statt nach Zeitplan. Das genügt: Was zu lange liegt,
 * verschwindet spätestens beim nächsten Blick in den Papierkorb.
 */

const PAPIERKORB_TAGE = 30;

/** Entfernt endgültig, was länger als die Frist im Papierkorb liegt. */
function papierkorb_aufraeumen(string $userId): int
{
    return execute(
        'DELETE FROM recipes
          WHERE user_id = ?
            AND deleted_at IS NOT NULL
            AND deleted_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
        [$userId, PAPIERKORB_TAGE],
    );
}
