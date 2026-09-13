<?php
/**
 * Supermarktbereiche und Sinnbilder.
 *
 * Steht getrennt von der Einkaufsliste, weil der Vorrat dieselbe Einteilung
 * benutzt – und weil sich sonst zwei Dateien gegenseitig laden müssten.
 */

require_once __DIR__ . '/ingredients.php';

/** Reihenfolge, in der die Bereiche in der Liste stehen – Einkaufsweg im Laden. */
const LADEN_BEREICHE = [
    'produce', 'bakery', 'dairy', 'meat', 'frozen', 'dry', 'spices', 'drinks', 'household', 'other',
];

/**
 * Stichwörter je Bereich, um eine Zutat einzuordnen.
 *
 * Geprüft wird gegen den <strong>rohen Namen</strong>, nur kleingeschrieben und
 * ohne Umlaute — <em>nicht</em> gegen den vereinheitlichten Zutatenschlüssel.
 * Der kürzt zu stark: aus "Basmatireis" wird dort "basmatirei", aus "Ingwer"
 * wird "ingw". Für das Zusammenfassen gleicher Zutaten ist das richtig, zum
 * Einordnen taugt es nicht.
 */
/**
 * Kurze Stichwörter, die nur als ganzes Wort zählen dürfen.
 * "ei" steckt sonst in Basmatireis, Petersilie und Eis.
 */
const BEREICH_GANZWORT = [
    'dairy' => ['ei', 'eier'],
];

/**
 * Wörter, die vor allem anderen gewinnen.
 *
 * Sie enthalten ein Stichwort eines anderen Bereichs als Bestandteil:
 * "Zuckerschoten" fangen mit "zucker" an, sind aber Gemüse. Solche Fälle lassen
 * sich nur durch Vorrang lösen, nicht durch Reihenfolge der Bereiche.
 */
const BEREICH_AUSNAHMEN = [
    'produce' => ['zuckerschot', 'zuckermais', 'zuckerhut', 'eisbergsalat', 'eichblatt'],
    'drinks'  => ['kaffeebohn', 'kaffeepulver'],
    'dry'     => ['salzstang', 'salzbrezel'],
];

const BEREICH_STICHWOERTER = [
    'frozen' => ['tiefkuehl', 'tiefgefror', 'gefror', 'eiscreme', 'speiseeis'],
    'produce' => [
        'apfel', 'banan', 'birn', 'beer', 'zitron', 'limett', 'orang', 'traub', 'melon',
        'pfirsich', 'pflaum', 'kirsch', 'mango', 'avocado', 'ananas',
        'zwiebel', 'schalotte', 'knoblauch', 'karott', 'kartoffel', 'tomat', 'gurk', 'paprika',
        'zucchini', 'aubergin', 'brokkoli', 'blumenkohl', 'kohl', 'salat', 'spinat',
        'lauch', 'porree', 'sellerie', 'radiesch', 'rettich', 'kuerbis', 'pilz', 'champignon',
        'ingwer', 'petersili', 'schnittlauch', 'basilikum', 'koriand', 'dill',
        'edamame', 'sojabohn', 'zuckerschot', 'sprossen', 'kresse', 'rhabarber',
        'rosmarin', 'thymian', 'minz', 'bohn', 'erbs', 'mais', 'spargel', 'fenchel',
    ],
    'bakery' => ['brot', 'broetchen', 'semmel', 'baguette', 'toast', 'croissant', 'brezel'],
    'dairy'  => [
        'milch', 'sahne', 'quark', 'joghurt', 'kaese', 'butter', 'schmand',
        'creme fraiche', 'frischkaese', 'mozzarella', 'feta', 'parmesan',
    ],
    'meat'   => [
        'fleisch', 'hack', 'haehnchen', 'huhn', 'pute', 'rind', 'schwein', 'lamm',
        'wurst', 'schinken', 'speck', 'salami', 'fisch', 'lachs', 'thunfisch',
        'garnel', 'shrimp',
    ],
    'drinks' => ['wasser', 'saft', 'wein', 'bier', 'limonad', 'kaffe', 'tee', 'sekt'],
    'household' => ['spuelmittel', 'putz', 'muellbeutel', 'kuechenrolle', 'klopapier', 'folie'],
    // Gewürze stehen vor der Trockenware: "Currypaste" und "Paprikapulver"
    // sollen ins Gewürzregal, nicht zu Mehl und Nudeln.
    'spices' => [
        'gewuerz', 'salz', 'pfeffer', 'curry', 'paprikapulver', 'chili', 'kreuzkuemmel',
        'kuemmel', 'koriandersamen', 'zimt', 'muskat', 'kurkuma', 'safran', 'vanille',
        'lorbeer', 'oregano', 'majoran', 'thymian getrocknet', 'rosmarin getrocknet',
        'kraeutermischung', 'garam masala', 'ras el hanout', 'harissa', 'senfkoern',
        'nelke', 'kardamom', 'ingwerpulver', 'knoblauchpulver', 'zwiebelpulver',
    ],
    'dry' => [
        'mehl', 'zucker', 'reis', 'nudel', 'pasta', 'spaghetti',
        'linse', 'kichererbs', 'quinoa', 'couscous', 'bulgur', 'hafer', 'muesli',
        'oel', 'essig', 'senf', 'ketchup', 'sojasoss', 'tomatenmark', 'bruehe',
        'konserv', 'dose', 'nuss', 'mandel', 'schokolad', 'kakao', 'honig',
        'backpulver', 'hefe', 'kokos',
    ],
];

/**
 * Sinnbild je Zutat, zum Wiedererkennen beim Einkaufen.
 *
 * Emoji statt Bilddateien: nichts nachzuladen, überall vorhanden, und die
 * Liste bleibt im Quelltext lesbar. Zugeordnet wird über denselben Weg wie der
 * Bereich, nur feiner — was hier nicht steht, bekommt das Sinnbild seines
 * Bereichs.
 */
const ZUTAT_SINNBILDER = [
    // Das Genauere zuerst: "Kokosmilch" ist keine Milch, "Kichererbsen" sind
    // keine Erbsen, "Frühlingszwiebeln" keine Zwiebeln. Die erste
    // Übereinstimmung gewinnt, deshalb stehen die Sonderfälle oben.
    '🥥' => ['kokos'],
    '☕' => ['kaffee', 'espresso'],
    // Gemahlenes und Getrocknetes ist ein Gewürz, kein Gemüse: "Paprikapulver"
    // gehört ins Streuglas, nicht ins Gemüsefach.
    '🧂' => [
        'pulver', 'gewuerz', 'gemahlen', 'getrocknet',
        'salz', 'pfeffer', 'curry', 'zimt', 'muskat', 'vanille', 'lorbeer', 'chili',
        'kurkuma', 'safran', 'kardamom', 'nelke', 'oregano', 'majoran',
    ],
    '🫘' => ['kichererbse', 'linse', 'bohne'],
    '🌱' => ['fruehlingszwiebel', 'lauchzwiebel', 'zwiebelgruen', 'sprossen', 'kresse'],
    // Knoblauch vor Lauch: "Knoblauch" enthält "lauch" als Bestandteil.
    '🧄' => ['knoblauch'],
    '🧅' => ['zwiebel', 'schalotte'],
    '🪴' => ['lauch', 'porree', 'staudensellerie'],
    '🥕' => ['karotte', 'moehre', 'mohrruebe'],
    '🥔' => ['kartoffel', 'erdaepfel'],
    '🍅' => ['tomate', 'passierte tomaten', 'tomatenmark'],
    '🥒' => ['gurke', 'zucchini'],
    '🫑' => ['paprika'],
    '🍆' => ['aubergine'],
    '🥦' => ['brokkoli', 'blumenkohl'],
    '🥬' => ['salat', 'spinat', 'kohl', 'mangold'],
    '🍄' => ['pilz', 'champignon'],
    '🌽' => ['mais'],
    '🫛' => ['erbse', 'edamame', 'zuckerschot'],
    '🍋' => ['zitrone', 'limette'],
    '🍎' => ['apfel'],
    '🍌' => ['banane'],
    '🍓' => ['erdbeere', 'beere'],
    '🍊' => ['orange', 'mandarine'],
    '🥑' => ['avocado'],
    '🌿' => ['petersilie', 'basilikum', 'koriander', 'dill', 'schnittlauch', 'minze', 'rosmarin', 'thymian'],
    '🫚' => ['ingwer'],
    '🥛' => ['milch', 'sahne', 'schmand', 'buttermilch'],
    '🧀' => ['kaese', 'feta', 'mozzarella', 'parmesan', 'frischkaese'],
    '🧈' => ['butter', 'margarine'],
    '🥣' => ['joghurt', 'quark', 'skyr'],
    '🥚' => ['ei', 'eier'],
    '🥩' => ['rind', 'steak', 'hack', 'fleisch', 'lamm', 'schwein'],
    '🍗' => ['haehnchen', 'huhn', 'pute', 'gefluegel'],
    '🥓' => ['speck', 'schinken', 'bacon'],
    '🌭' => ['wurst', 'salami'],
    '🐟' => ['fisch', 'lachs', 'thunfisch', 'forelle'],
    '🦐' => ['garnele', 'shrimp'],
    '🍞' => ['brot', 'toast', 'broetchen', 'semmel', 'baguette'],
    '🥐' => ['croissant', 'gebaeck'],
    '🥨' => ['brezel'],
    '🍚' => ['reis'],
    '🍝' => ['nudel', 'pasta', 'spaghetti', 'penne'],
    '🌾' => ['mehl', 'hafer', 'quinoa', 'couscous', 'bulgur', 'muesli', 'grieß', 'griess'],
    '🫒' => ['oel', 'olive'],
    '🍯' => ['honig', 'sirup'],
    '🍫' => ['schokolade', 'kakao'],
    '🥜' => ['nuss', 'mandel', 'erdnuss', 'cashew'],
    '🍬' => ['zucker'],
    '🍵' => ['tee'],
    '💧' => ['wasser'],
    '🧃' => ['saft', 'limonade'],
    '🍷' => ['wein', 'sekt'],
    '🍺' => ['bier'],
    '🧊' => ['tiefkuehl', 'gefror', 'eiscreme'],
    '🧴' => ['spuelmittel', 'putz'],
    '🧻' => ['kuechenrolle', 'klopapier'],
];

/**
 * Bereiche mit verderblicher Ware.
 *
 * Was hier liegt und erst in einigen Tagen gebraucht wird, kauft man besser
 * später — sonst liegt der Salat eine Woche im Kühlschrank. Trockenware und
 * Haushaltszeug sind davon nicht betroffen.
 */
const FRISCHE_BEREICHE = ['produce', 'dairy', 'meat', 'bakery'];

/** Ab so vielen Tagen Vorlauf lohnt für frische Ware ein zweiter Einkauf. */
const FRISCHE_VORLAUF_TAGE = 4;

/** Rückfallebene: ein Sinnbild je Bereich. */
const BEREICH_SINNBILDER = [
    'produce'   => '🥬',
    'dairy'     => '🥛',
    'meat'      => '🥩',
    'frozen'    => '🧊',
    'dry'       => '🥫',
    'spices'    => '🧂',
    'bakery'    => '🍞',
    'drinks'    => '🥤',
    'household' => '🧽',
    'other'     => '🛒',
];

/** Kleingeschrieben und ohne Umlaute – die Form, in der verglichen wird. */
function laden_name_normalisieren(string $name): string
{
    $n = mb_strtolower(trim($name));
    return strtr($n, [
        'ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss',
        '-' => ' ', '_' => ' ',
    ]);
}

/**
 * Rät den Supermarktbereich aus dem Namen.
 *
 * Bewusst eine Schätzung: Sie spart Tipparbeit, entscheidet aber nichts
 * Wichtiges – falsch einsortiert heißt nur, dass ein Posten im Laden an der
 * falschen Stelle steht. Änderbar ist er immer.
 */
function laden_bereich_raten(string $name): string
{
    $n = laden_name_normalisieren($name);

    // Ausnahmen vor allem anderen – "Zuckerschoten" sind kein Zucker.
    foreach (BEREICH_AUSNAHMEN as $bereich => $woerter) {
        foreach ($woerter as $wort) {
            if (str_contains($n, $wort)) {
                return $bereich;
            }
        }
    }

    // Ganze Wörter zuerst: "Ei" ja, "Basmatireis" nein.
    foreach (BEREICH_GANZWORT as $bereich => $woerter) {
        foreach ($woerter as $wort) {
            if (preg_match('/(?:^|\s)' . preg_quote($wort, '/') . '(?:\s|$)/u', $n)) {
                return $bereich;
            }
        }
    }

    // Tiefkühl, Gewürze und Trockenware vor den übrigen prüfen: "Kokosmilch"
    // ist Trockenware und kein Milchprodukt, "Knoblauchpulver" ein Gewürz und
    // kein Gemüse, "tiefgefrorene Erbsen" gehören in die Truhe.
    foreach (['frozen', 'spices', 'dry'] as $bereich) {
        foreach (BEREICH_STICHWOERTER[$bereich] as $wort) {
            if (str_contains($n, $wort)) {
                return $bereich;
            }
        }
    }

    foreach (BEREICH_STICHWOERTER as $bereich => $woerter) {
        if (in_array($bereich, ['frozen', 'spices', 'dry'], true)) {
            continue;
        }
        foreach ($woerter as $wort) {
            if (str_contains($n, $wort)) {
                return $bereich;
            }
        }
    }

    return 'other';
}

/**
 * Der letzte Tag vor dem Bedarf, an dem eingekauft werden kann.
 *
 * Sonntags und an Feiertagen haben die Läden zu. Wird etwas an einem solchen
 * Tag gebraucht, muss es vorher gekauft werden — die Liste soll das Datum
 * nennen, an dem man tatsächlich losgeht, nicht das, an dem gekocht wird.
 *
 * Gibt Datum und Grund zurück; der Grund ist null, wenn nichts verschoben
 * werden musste.
 */
function einkauf_kauftag(string $bedarf, string $land): array
{
    $grund = null;
    $tag = $bedarf;

    // Höchstens eine Woche zurück – mehr wäre keine Verschiebung mehr,
    // sondern ein Fehler in den Feiertagsdaten.
    for ($i = 0; $i < 8; $i++) {
        $istSonntag = (int) date('N', strtotime($tag)) === 7;
        $feiertag = feiertag_name($tag, $land);

        if (!$istSonntag && $feiertag === null) {
            return ['date' => $tag, 'reason' => $grund];
        }

        $grund = $feiertag ?? 'Sonntag';
        $tag = date('Y-m-d', strtotime("$tag -1 day"));
    }

    return ['date' => $bedarf, 'reason' => null];
}

