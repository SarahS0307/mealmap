<?php
/**
 * Vereinheitlicht Zutatennamen für den Abgleich.
 *
 * "Zwiebeln", "Zwiebel" und "rote Zwiebel" landen auf demselben Schlüssel und
 * lassen sich damit in der Einkaufsliste zu einem Posten zusammenfassen.
 *
 * Einzige Fassung im Projekt: Die Normalisierung passiert ausschließlich auf
 * dem Server. Eine zweite Umsetzung im Browser gab es früher – sie ist bewusst
 * entfallen, weil zwei Fassungen unweigerlich auseinanderlaufen.
 *
 * Bewusst einfach gehalten: erkennt die häufigsten deutschen Pluralformen, für
 * unregelmäßige gibt es eine Ausnahmeliste. Wird mit echten Daten nachgeschärft.
 */

function zutaten_schluessel(string $name): string
{
    $key = mb_strtolower(trim($name));
    $key = strtr($key, ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss']);
    $key = preg_replace('/[^a-z0-9\s-]/', '', $key) ?? '';
    $key = preg_replace('/\s+/', ' ', $key) ?? '';

    // Beschreibende Vorsilben entfernen, damit "rote Zwiebel" zu "zwiebel" wird.
    $key = preg_replace(
        '/^(frische?r?s?|getrocknete?r?s?|rote?r?s?|gruene?r?s?|gelbe?r?s?|weisse?r?s?|kleine?r?s?|grosse?r?s?)\s+/',
        '',
        $key,
    ) ?? '';

    // Unregelmäßige Formen, die keine Regel erfasst. Liste wächst mit der Praxis.
    $unregelmaessig = [
        'eier'     => 'ei',
        'aepfel'   => 'apfel',
        'glaeser'  => 'glas',
        'blaetter' => 'blatt',
        'boeden'   => 'boden',
        'wuerste'  => 'wurst',
        'saefte'   => 'saft',
        'naegel'   => 'nagel',
    ];
    if (isset($unregelmaessig[$key])) {
        return $unregelmaessig[$key];
    }

    // Häufige deutsche Pluralendungen auf den Singular zurückführen.
    foreach ([['nnen', 'n'], ['en', ''], ['er', ''], ['n', ''], ['e', ''], ['s', '']] as [$endung, $ersatz]) {
        if (!str_ends_with($key, $endung)) {
            continue;
        }
        $stamm = substr($key, 0, strlen($key) - strlen($endung)) . $ersatz;
        // Kurze Wörter nicht anschneiden – aus "Ei" darf kein "" werden.
        if (strlen($stamm) >= 3) {
            return $stamm;
        }
    }

    return $key;
}
