<?php
/**
 * Vereinheitlicht Zutatennamen für den Abgleich in der Einkaufsliste.
 *
 * Drei Regeln, in dieser Reihenfolge:
 *
 *   1. Beschreibende Wörter fallen weg. Farbe, Größe und Herkunft ändern für
 *      den Einkauf nichts: rote, weiße, gelbe und große Zwiebeln sind Zwiebeln.
 *   2. Gleichbedeutende Namen werden zusammengeführt. Möhren und Karotten sind
 *      dasselbe Gemüse, nur anders benannt.
 *   3. Der Plural wird auf den Singular zurückgeführt.
 *
 * Ausdrücklich NICHT zusammengeführt werden zusammengesetzte Wörter. Eine
 * Frühlingszwiebel ist keine Zwiebel, eine Röstzwiebel erst recht nicht. Das
 * ergibt sich von selbst, weil Regel 1 nur auf eigenständige Wörter greift –
 * an einem Wortanfang wird nichts abgeschnitten.
 *
 * Einzige Fassung im Projekt: Die Normalisierung passiert nur auf dem Server.
 */

/**
 * Beschreibende Wörter, die als eigenständiges Wort vorangestellt sein können.
 * Bewusst nur solche, die das Produkt nicht verändern. Nicht dabei sind etwa
 * "gemahlen" oder "gekocht" – gemahlener Kaffee ist etwas anderes als Bohnen.
 */
const ZUTAT_BEIWOERTER = [
    // Farbe
    'rot', 'gruen', 'gelb', 'weiss', 'braun', 'schwarz', 'lila', 'violett', 'orange',
    // Größe und Menge
    'gross', 'klein', 'mittel', 'mittler', 'mittelgross', 'extra',
    // Frische und Herkunft
    'frisch', 'bio', 'regional', 'reif',
];

/**
 * Gleichbedeutende Namen. Links der Stamm nach Singularbildung, rechts der
 * gemeinsame Schlüssel – ebenfalls als Stamm, damit beide Seiten zusammenpassen.
 */
const ZUTAT_GLEICHBEDEUTEND = [
    // Gemüse
    'moehr'         => 'karott',
    'mohrrueb'      => 'karott',
    'wurzel'        => 'karott',
    'karfiol'       => 'blumenkohl',
    'kohlspross'    => 'rosenkohl',
    'melanzani'     => 'aubergin',
    'zucchetti'     => 'zucchini',
    'paradeis'      => 'tomat',
    'erdaepfel'     => 'kartoffel',
    'erdapfel'      => 'kartoffel',
    'porre'         => 'lauch',
    // Milchprodukte
    'topfen'        => 'quark',
    'topf'          => 'quark',
    'rahm'          => 'sahn',
    'schlagsahn'    => 'sahn',
    'schlagober'    => 'sahn',
    'suessrahm'     => 'sahn',
    // Fleisch
    'faschiert'     => 'hackfleisch',
    'hack'          => 'hackfleisch',
    'gehackt'       => 'hackfleisch',
    // Backwaren
    'semmel'        => 'broetchen',
    'schripp'       => 'broetchen',
    // Sonstiges
    'ribisel'       => 'johannisbeer',
    'eierschwammerl'=> 'pfifferling',
];

/** Unregelmäßige Pluralformen, die keine Regel erfasst. */
const ZUTAT_UNREGELMAESSIG = [
    'eier'      => 'ei',
    'aepfel'    => 'apfel',
    'glaeser'   => 'glas',
    'blaetter'  => 'blatt',
    'wuerste'   => 'wurst',
    'saefte'    => 'saft',
    'haehnchen' => 'haehnchen',
    'kaese'     => 'kaese',
];

function zutaten_schluessel(string $name): string
{
    $key = mb_strtolower(trim($name));
    $key = strtr($key, ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss']);
    // Bindestriche trennen Wörter ("Bio-Eier" ist "bio eier").
    $key = str_replace('-', ' ', $key);
    $key = preg_replace('/[^a-z0-9\s]/', '', $key) ?? '';
    $key = trim(preg_replace('/\s+/', ' ', $key) ?? '');

    // Regel 1: beschreibende Wörter am Anfang entfernen, auch mehrere
    // hintereinander ("große rote Zwiebeln"). Die Beugungsendungen sind offen
    // gelassen, damit "rote", "roter" und "rotes" gleich behandelt werden.
    $beiwoerter = implode('|', array_map(
        static fn(string $w): string => $w . '(e|er|es|en|em)?',
        ZUTAT_BEIWOERTER,
    ));
    $vorher = null;
    while ($vorher !== $key) {
        $vorher = $key;
        $key = trim(preg_replace('/^(' . $beiwoerter . ')\s+/', '', $key) ?? $key);
    }

    // Mehrere Wörter ohne Trennung zusammenziehen, damit "rote bete" und
    // "rotebete" denselben Schlüssel ergeben.
    $key = str_replace(' ', '', $key);

    // Regel 2 kann schon vor der Singularbildung greifen, wenn der Name selbst
    // die Pluralform ist ("Topfen" wäre sonst zu "topf" gekürzt worden).
    if (isset(ZUTAT_GLEICHBEDEUTEND[$key])) {
        return ZUTAT_GLEICHBEDEUTEND[$key];
    }

    if (isset(ZUTAT_UNREGELMAESSIG[$key])) {
        $key = ZUTAT_UNREGELMAESSIG[$key];
    } else {
        // Regel 3: häufige deutsche Pluralendungen auf den Singular zurückführen.
        foreach ([['nnen', 'n'], ['en', ''], ['er', ''], ['n', ''], ['e', ''], ['s', '']] as [$endung, $ersatz]) {
            if (!str_ends_with($key, $endung)) {
                continue;
            }
            $stamm = substr($key, 0, strlen($key) - strlen($endung)) . $ersatz;
            // Kurze Wörter nicht anschneiden – aus "Ei" darf kein "" werden.
            if (strlen($stamm) >= 3) {
                $key = $stamm;
            }
            break;
        }
    }

    // Regel 2 zuletzt: jetzt liegen beide Seiten als Stamm vor.
    return ZUTAT_GLEICHBEDEUTEND[$key] ?? $key;
}
