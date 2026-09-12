<?php
/**
 * Versteht kurze Änderungswünsche zu einem Rezept und setzt sie um.
 *
 * Gedacht für den Alltag: „2 statt 3 Eier“, „ohne Zwiebeln“, „500 g Mehl“.
 * Erkannt werden feste Muster, keine beliebigen Sätze – das kommt mit dem
 * KI-Import in Phase 3 dazu. Was nicht erkannt wird, wird auch nicht geraten,
 * sondern als unverstanden zurückgemeldet.
 *
 * Zutaten werden über den vereinheitlichten Schlüssel gefunden, damit auch
 * „Zwiebel“ das Rezept trifft, in dem „rote Zwiebeln“ steht.
 */

require_once __DIR__ . '/ingredients.php';

/**
 * Wertet eine Zeile aus und gibt die geplante Änderung zurück.
 *
 * Rückgabe je Eintrag:
 *   art     = 'menge' | 'entfernen' | 'ersetzen' | 'hinzufuegen' | 'unklar'
 *   text    = die ursprüngliche Zeile
 *   ...     = je nach Art die Einzelheiten
 */
function aenderung_deuten(string $zeile, array $zutaten): array
{
    $z = trim($zeile);
    if ($z === '') {
        return [];
    }

    $zahl = '(\d+(?:[.,]\d+)?)';
    $einheit = '([a-zA-ZäöüÄÖÜß]{1,12})?';

    // "ohne Zwiebeln", "keine Zwiebeln", "Zwiebeln weglassen"
    if (preg_match('/^(?:ohne|keine?n?)\s+(.+)$/iu', $z, $t)
        || preg_match('/^(.+?)\s+weglassen$/iu', $z, $t)) {
        $treffer = zutat_finden($t[1], $zutaten);
        return $treffer
            ? ['art' => 'entfernen', 'text' => $z, 'zutat' => $treffer]
            : ['art' => 'unklar', 'text' => $z, 'grund' => "„{$t[1]}“ steht nicht im Rezept."];
    }

    // "Butter durch Öl ersetzen", "Butter statt Öl" -> Name tauschen
    if (preg_match('/^(.+?)\s+durch\s+(.+?)\s+ersetzen$/iu', $z, $t)) {
        $treffer = zutat_finden($t[1], $zutaten);
        return $treffer
            ? ['art' => 'ersetzen', 'text' => $z, 'zutat' => $treffer, 'neuerName' => trim($t[2])]
            : ['art' => 'unklar', 'text' => $z, 'grund' => "„{$t[1]}“ steht nicht im Rezept."];
    }

    // "2 statt 3 Eier" – die erste Zahl ist die neue Menge
    if (preg_match('/^' . $zahl . '\s*' . $einheit . '\s+statt\s+' . $zahl . '\s*' . $einheit . '?\s*(.+)$/iu', $z, $t)) {
        $treffer = zutat_finden($t[5], $zutaten);
        return $treffer
            ? [
                'art'     => 'menge',
                'text'    => $z,
                'zutat'   => $treffer,
                'menge'   => (float) str_replace(',', '.', $t[1]),
                'einheit' => $t[2] !== '' ? $t[2] : ($treffer['unit'] ?? null),
            ]
            : ['art' => 'unklar', 'text' => $z, 'grund' => "„{$t[5]}“ steht nicht im Rezept."];
    }

    // "Eier: 2" oder "Eier 2" oder "500 g Mehl"
    if (preg_match('/^' . $zahl . '\s*' . $einheit . '\s+(.+)$/iu', $z, $t)) {
        $treffer = zutat_finden($t[3], $zutaten);
        if ($treffer) {
            return [
                'art'     => 'menge',
                'text'    => $z,
                'zutat'   => $treffer,
                'menge'   => (float) str_replace(',', '.', $t[1]),
                'einheit' => $t[2] !== '' ? $t[2] : ($treffer['unit'] ?? null),
            ];
        }
        // Nicht im Rezept: als neue Zutat anbieten.
        return [
            'art'     => 'hinzufuegen',
            'text'    => $z,
            'name'    => trim($t[3]),
            'menge'   => (float) str_replace(',', '.', $t[1]),
            'einheit' => $t[2] !== '' ? $t[2] : null,
        ];
    }

    if (preg_match('/^(.+?)\s*:\s*' . $zahl . '\s*' . $einheit . '$/iu', $z, $t)) {
        $treffer = zutat_finden($t[1], $zutaten);
        return $treffer
            ? [
                'art'     => 'menge',
                'text'    => $z,
                'zutat'   => $treffer,
                'menge'   => (float) str_replace(',', '.', $t[2]),
                'einheit' => ($t[3] ?? '') !== '' ? $t[3] : ($treffer['unit'] ?? null),
            ]
            : ['art' => 'unklar', 'text' => $z, 'grund' => "„{$t[1]}“ steht nicht im Rezept."];
    }

    return ['art' => 'unklar', 'text' => $z, 'grund' => 'Diesen Wunsch verstehe ich nicht.'];
}

/** Sucht eine Zutat über den vereinheitlichten Schlüssel. */
function zutat_finden(string $suche, array $zutaten): ?array
{
    $schluessel = zutaten_schluessel($suche);
    if ($schluessel === '') {
        return null;
    }

    foreach ($zutaten as $z) {
        if (zutaten_schluessel($z['name']) === $schluessel) {
            return $z;
        }
    }
    return null;
}

/** Wertet einen mehrzeiligen Wunsch aus. Eine Zeile, ein Wunsch. */
function aenderungen_deuten(string $eingabe, array $zutaten): array
{
    $ergebnis = [];
    foreach (preg_split('/[\n;]+/u', $eingabe) ?: [] as $zeile) {
        $gedeutet = aenderung_deuten($zeile, $zutaten);
        if ($gedeutet !== []) {
            $ergebnis[] = $gedeutet;
        }
    }
    return $ergebnis;
}
