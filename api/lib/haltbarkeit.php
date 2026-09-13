<?php
/**
 * Wie schnell etwas verdirbt.
 *
 * Gebraucht an zwei Stellen: im Vorrat, damit man sieht, was zuerst weg muss,
 * und auf der Einkaufsliste, damit man weiß, was am Einkaufstag noch verarbeitet
 * werden will.
 *
 * Drei Stufen, weil zwei zu grob sind: Hackfleisch ist etwas anderes als ein
 * Kopfsalat, und der ist etwas anderes als eine Tüte Mehl.
 */

/** Muss am Kauftag verarbeitet oder eingefroren werden. */
const HALTBAR_SOFORT = 'sofort';

/** Hält ein paar Tage, gehört aber nach vorn. */
const HALTBAR_SCHNELL = 'schnell';

/** Unkritisch. */
const HALTBAR_NORMAL = 'normal';

/**
 * Was am Kauftag verarbeitet oder eingefroren gehört.
 *
 * Hackfleisch steht hier ausdrücklich: Sarahs Vorgabe ist, es <em>immer</em> am
 * Kauftag zu verarbeiten oder einzufrieren. Rohes Geflügel und frischer Fisch
 * gehören derselben Gruppe an.
 */
const HALTBAR_SOFORT_WOERTER = [
    'hack', 'mett', 'tatar', 'gehacktes',
    'haehnchen', 'hahnchen', 'huhn', 'haehnchenbrust', 'pute', 'gefluegel',
    'fisch', 'lachs', 'forelle', 'kabeljau', 'garnele', 'shrimp', 'muschel',
    'leber', 'innereien', 'rohwurst',
];

/** Was ein paar Tage hält, aber nicht lange. */
const HALTBAR_SCHNELL_WOERTER = [
    'salat', 'rucola', 'feldsalat', 'spinat', 'mangold', 'kraeuter',
    'petersilie', 'basilikum', 'koriander', 'dill', 'schnittlauch', 'minze',
    'beere', 'erdbeere', 'himbeere', 'brombeere', 'heidelbeere',
    'pilz', 'champignon', 'spargel', 'avocado', 'banane', 'trauben',
    'milch', 'sahne', 'quark', 'joghurt', 'frischkaese', 'schmand',
    'fleisch', 'wurst', 'schinken', 'aufschnitt', 'tofu',
    'brot', 'broetchen', 'semmel', 'baguette', 'croissant',
];

/** Ab wie vielen Tagen bis zum Haltbarkeitsdatum es knapp wird. */
const HALTBAR_BALD_TAGE = 3;

/**
 * Schätzt die Verderblichkeit aus dem Namen.
 *
 * Wie beim Supermarktbereich geprüft: gegen den rohen Namen, kleingeschrieben
 * und ohne Umlaute. Der Zutatenschlüssel kürzt zu stark, um hier zu taugen.
 */
function haltbarkeit_raten(string $name): string
{
    $n = strtr(mb_strtolower(trim($name)), [
        'ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss', '-' => ' ', '_' => ' ',
    ]);

    // Was gar nicht verdirbt, zuerst ausschließen: Tiefgekühltes ist schon
    // eingefroren, Kokosmilch aus der Dose ist keine Milch, und Konserven sind
    // ohnehin haltbar. Sonst greift weiter unten das Stichwort "milch".
    foreach (['tiefkuehl', 'tiefgefror', 'gefror', 'kokos', 'konserve', 'dose', 'kondensmilch', 'h milch', 'haltbare milch'] as $wort) {
        if (str_contains($n, $wort)) {
            return HALTBAR_NORMAL;
        }
    }

    foreach (HALTBAR_SOFORT_WOERTER as $wort) {
        if (str_contains($n, $wort)) {
            return HALTBAR_SOFORT;
        }
    }
    foreach (HALTBAR_SCHNELL_WOERTER as $wort) {
        if (str_contains($n, $wort)) {
            return HALTBAR_SCHNELL;
        }
    }

    return HALTBAR_NORMAL;
}

/** Ein Satz, der erklärt, was die Stufe bedeutet. Null bei unkritisch. */
function haltbarkeit_hinweis(string $stufe): ?string
{
    return match ($stufe) {
        HALTBAR_SOFORT  => 'Am Kauftag verarbeiten oder einfrieren.',
        HALTBAR_SCHNELL => 'Hält nur wenige Tage – bald verbrauchen.',
        default         => null,
    };
}

/**
 * Wie viele Tage bis zum Haltbarkeitsdatum. Negativ heißt abgelaufen,
 * null heißt: kein Datum hinterlegt.
 */
function haltbarkeit_tage_bis(?string $datum): ?int
{
    if ($datum === null || $datum === '') {
        return null;
    }
    return (int) floor((strtotime($datum) - strtotime(date('Y-m-d'))) / 86400);
}

/**
 * Der Zustand eines Vorratspostens: abgelaufen, bald fällig, oder in Ordnung.
 *
 * Ohne Haltbarkeitsdatum entscheidet die geschätzte Verderblichkeit — dann ist
 * es eine Warnung ohne Frist, keine Zusage.
 */
function haltbarkeit_zustand(?string $datum, string $stufe): string
{
    $tage = haltbarkeit_tage_bis($datum);

    if ($tage !== null) {
        if ($tage < 0) return 'abgelaufen';
        if ($tage <= HALTBAR_BALD_TAGE) return 'bald';
        return 'ok';
    }

    return $stufe === HALTBAR_SOFORT || $stufe === HALTBAR_SCHNELL ? 'bald' : 'ok';
}
