<?php
/**
 * Gesetzliche Feiertage in Deutschland, je Bundesland.
 *
 * Gebraucht an zwei Stellen: Einkaufstage (an Feiertagen haben die Läden zu
 * oder nur eingeschränkt offen) und die Standardvorbelegung im Plan (an einem
 * Feiertag ist Sarah mittags daheim, nicht im Geschäft).
 *
 * Die Tabelle steht bewusst nur hier und nicht noch einmal im Frontend: die
 * Plan-Ausgabe liefert je Tag mit, ob er ein Feiertag ist und ob eingekauft
 * werden kann. Eine zweite Fassung in TypeScript würde früher oder später
 * auseinanderlaufen.
 *
 * Bewusst weggelassen: Feiertage, die nur für einzelne Gemeinden gelten
 * (Augsburger Friedensfest; Mariä Himmelfahrt in Bayern hängt an der
 * Konfession der Gemeinde). Das ließe sich ohne Ortsangabe nur raten.
 */

/** Vorgabe, solange niemand etwas anderes eingestellt hat. */
const FEIERTAG_STANDARD_LAND = 'BW';

/** Die sechzehn Länder, für die Auswahl in den Einstellungen. */
const BUNDESLAENDER = [
    'BW' => 'Baden-Württemberg',
    'BY' => 'Bayern',
    'BE' => 'Berlin',
    'BB' => 'Brandenburg',
    'HB' => 'Bremen',
    'HH' => 'Hamburg',
    'HE' => 'Hessen',
    'MV' => 'Mecklenburg-Vorpommern',
    'NI' => 'Niedersachsen',
    'NW' => 'Nordrhein-Westfalen',
    'RP' => 'Rheinland-Pfalz',
    'SL' => 'Saarland',
    'SN' => 'Sachsen',
    'ST' => 'Sachsen-Anhalt',
    'SH' => 'Schleswig-Holstein',
    'TH' => 'Thüringen',
];

function bundesland_gueltig(string $land): bool
{
    return isset(BUNDESLAENDER[$land]);
}

/**
 * Ostersonntag eines Jahres.
 *
 * PHP bringt easter_date() mit, aber nur wenn die Kalender-Erweiterung
 * einkompiliert ist – auf Strato ist darauf kein Verlass. Deshalb hier die
 * Gaußsche Osterformel von Hand, die kommt ohne Erweiterung aus.
 */
function feiertag_ostersonntag(int $jahr): string
{
    $a = $jahr % 19;
    $b = intdiv($jahr, 100);
    $c = $jahr % 100;
    $d = intdiv($b, 4);
    $e = $b % 4;
    $f = intdiv($b + 8, 25);
    $g = intdiv($b - $f + 1, 3);
    $h = (19 * $a + $b - $d - $g + 15) % 30;
    $i = intdiv($c, 4);
    $k = $c % 4;
    $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7;
    $m = intdiv($a + 11 * $h + 22 * $l, 451);
    $monat = intdiv($h + $l - 7 * $m + 114, 31);
    $tag = (($h + $l - 7 * $m + 114) % 31) + 1;

    return sprintf('%04d-%02d-%02d', $jahr, $monat, $tag);
}

/** Verschiebt ein Datum um Tage – kurz, weil es hier oft gebraucht wird. */
function feiertag_plus(string $datum, int $tage): string
{
    return date('Y-m-d', strtotime("$datum $tage days"));
}

/**
 * Alle Feiertage eines Jahres für ein Bundesland, als Datum => Name.
 *
 * Das Ergebnis wird je Jahr und Land zwischengespeichert – die Plan-Ansicht
 * fragt für jeden Tag eines Monats nach.
 */
function feiertage_im_jahr(int $jahr, string $land): array
{
    static $merker = [];
    $schluessel = "$jahr|$land";
    if (isset($merker[$schluessel])) {
        return $merker[$schluessel];
    }

    $ostern = feiertag_ostersonntag($jahr);

    // Überall in Deutschland.
    $tage = [
        sprintf('%04d-01-01', $jahr)  => 'Neujahr',
        feiertag_plus($ostern, -2)    => 'Karfreitag',
        feiertag_plus($ostern, 1)     => 'Ostermontag',
        sprintf('%04d-05-01', $jahr)  => 'Tag der Arbeit',
        feiertag_plus($ostern, 39)    => 'Christi Himmelfahrt',
        feiertag_plus($ostern, 50)    => 'Pfingstmontag',
        sprintf('%04d-10-03', $jahr)  => 'Tag der Deutschen Einheit',
        sprintf('%04d-12-25', $jahr)  => '1. Weihnachtstag',
        sprintf('%04d-12-26', $jahr)  => '2. Weihnachtstag',
    ];

    $dreikoenige   = sprintf('%04d-01-06', $jahr);
    $frauentag     = sprintf('%04d-03-08', $jahr);
    $fronleichnam  = feiertag_plus($ostern, 60);
    $himmelfahrtM  = sprintf('%04d-08-15', $jahr);
    $weltkindertag = sprintf('%04d-09-20', $jahr);
    $reformation   = sprintf('%04d-10-31', $jahr);
    $allerheiligen = sprintf('%04d-11-01', $jahr);

    switch ($land) {
        case 'BW':
            $tage[$dreikoenige]   = 'Heilige Drei Könige';
            $tage[$fronleichnam]  = 'Fronleichnam';
            $tage[$allerheiligen] = 'Allerheiligen';
            break;
        case 'BY':
            $tage[$dreikoenige]   = 'Heilige Drei Könige';
            $tage[$fronleichnam]  = 'Fronleichnam';
            $tage[$allerheiligen] = 'Allerheiligen';
            break;
        case 'BE':
            $tage[$frauentag] = 'Internationaler Frauentag';
            break;
        case 'BB':
            $tage[$ostern]              = 'Ostersonntag';
            $tage[feiertag_plus($ostern, 49)] = 'Pfingstsonntag';
            $tage[$reformation]         = 'Reformationstag';
            break;
        case 'HB':
        case 'HH':
        case 'NI':
        case 'SH':
            $tage[$reformation] = 'Reformationstag';
            break;
        case 'HE':
            $tage[$fronleichnam] = 'Fronleichnam';
            break;
        case 'MV':
            $tage[$frauentag]   = 'Internationaler Frauentag';
            $tage[$reformation] = 'Reformationstag';
            break;
        case 'NW':
        case 'RP':
            $tage[$fronleichnam]  = 'Fronleichnam';
            $tage[$allerheiligen] = 'Allerheiligen';
            break;
        case 'SL':
            $tage[$fronleichnam]  = 'Fronleichnam';
            $tage[$himmelfahrtM]  = 'Mariä Himmelfahrt';
            $tage[$allerheiligen] = 'Allerheiligen';
            break;
        case 'SN':
            $tage[$reformation] = 'Reformationstag';
            $tage[feiertag_buss_und_bettag($jahr)] = 'Buß- und Bettag';
            break;
        case 'ST':
            $tage[$dreikoenige] = 'Heilige Drei Könige';
            $tage[$reformation] = 'Reformationstag';
            break;
        case 'TH':
            $tage[$weltkindertag] = 'Weltkindertag';
            $tage[$reformation]   = 'Reformationstag';
            break;
    }

    ksort($tage);
    $merker[$schluessel] = $tage;
    return $tage;
}

/** Der Mittwoch vor dem 23. November. */
function feiertag_buss_und_bettag(int $jahr): string
{
    $datum = sprintf('%04d-11-22', $jahr);
    while ((int) date('N', strtotime($datum)) !== 3) {
        $datum = feiertag_plus($datum, -1);
    }
    return $datum;
}

/** Name des Feiertags – oder null, wenn der Tag keiner ist. */
function feiertag_name(string $datum, string $land): ?string
{
    $jahr = (int) substr($datum, 0, 4);
    return feiertage_im_jahr($jahr, $land)[$datum] ?? null;
}
