<?php
/**
 * Aufruf der Anthropic-API für den Rezept-Import.
 *
 * Bewusst über rohes HTTP statt über das PHP-SDK: Das Projekt hat keine
 * Composer-Abhängigkeiten, damit auf Strato nur Dateien hochgeladen werden
 * müssen. Ein SDK brächte einen vendor-Ordner mit, der mitgepflegt werden will.
 *
 * Der Schlüssel gehört dem Nutzer und liegt in der Datenbank. Er verlässt den
 * Server nie – die Oberfläche erfährt nur, ob einer hinterlegt ist.
 */

const CLAUDE_MODELL = 'claude-opus-5';
const CLAUDE_VERSION = '2023-06-01';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

/** Form, in der ein Rezept zurückkommen soll. */
function claude_rezept_schema(): array
{
    return [
        'type'       => 'object',
        'properties' => [
            'recipes' => [
                'type'  => 'array',
                'description' => 'Alle Rezepte, die in der Quelle stecken. Meist eines, manchmal mehrere.',
                'items' => [
                    'type'       => 'object',
                    'properties' => [
                        'title'       => ['type' => 'string'],
                        'servings'    => ['type' => 'integer'],
                        'prepMinutes' => ['type' => ['integer', 'null']],
                        'freezable'   => ['type' => 'boolean'],
                        'notes'       => ['type' => ['string', 'null']],
                        'categories'  => [
                            'type'        => 'array',
                            'description' => 'Passende Kategorien, höchstens drei.',
                            'items'       => ['type' => 'string'],
                        ],
                        'ingredients' => [
                            'type'  => 'array',
                            'items' => [
                                'type'       => 'object',
                                'properties' => [
                                    'name'   => ['type' => 'string'],
                                    'amount' => ['type' => ['number', 'null']],
                                    'unit'   => ['type' => ['string', 'null']],
                                ],
                                'required'             => ['name', 'amount', 'unit'],
                                'additionalProperties' => false,
                            ],
                        ],
                        'steps' => [
                            'type'  => 'array',
                            'items' => [
                                'type'       => 'object',
                                'properties' => [
                                    'title'        => ['type' => ['string', 'null']],
                                    'content'      => ['type' => 'string'],
                                    'timerSeconds' => ['type' => ['integer', 'null']],
                                ],
                                'required'             => ['title', 'content', 'timerSeconds'],
                                'additionalProperties' => false,
                            ],
                        ],
                    ],
                    'required' => [
                        'title', 'servings', 'prepMinutes', 'freezable',
                        'notes', 'categories', 'ingredients', 'steps',
                    ],
                    'additionalProperties' => false,
                ],
            ],
        ],
        'required'             => ['recipes'],
        'additionalProperties' => false,
    ];
}

function claude_anweisung(): string
{
    return <<<'TEXT'
Du liest Rezepte aus und gibst sie strukturiert zurück. Antworte auf Deutsch.

Regeln:
- Eine Quelle kann MEHRERE Rezepte enthalten. Gib dann auch mehrere zurück,
  statt sie zu einem zu vermischen.
- Übernimm Mengen so, wie sie dastehen. Rechne nichts um und denke dir nichts aus.
- Fehlt eine Angabe, setze null. Erfinde keine Zutaten und keine Zeiten.
- timerSeconds nur bei Schritten mit einer echten Wartezeit ("20 Minuten köcheln"),
  nicht bei "kurz anbraten".
- Zutatennamen in der Einzahl und ohne Mengenangabe im Namen.
- categories: höchstens drei kurze, sinnvolle Schlagworte (z. B. "Vegetarisch",
  "Meal Prep", "Schnell"). Keine ganzen Sätze.
- Enthält die Quelle gar kein Rezept, gib eine leere Liste zurück.
TEXT;
}

/**
 * Schickt Inhalte an die API und gibt die erkannten Rezepte zurück.
 *
 * $inhalte ist eine Liste von Inhaltsblöcken (Text, Bild, Dokument), wie sie
 * die API erwartet.
 */
function claude_rezepte_lesen(string $apiKey, array $inhalte): array
{
    return claude_json(
        $apiKey,
        claude_anweisung(),
        $inhalte,
        claude_rezept_schema(),
        'recipes',
        16000,
    );
}

/**
 * Ein Aufruf bei Anthropic mit fest vorgegebener Antwortform.
 *
 * $schluessel ist der Name des Feldes im Schema, dessen Inhalt zurückkommt –
 * die Antwort ist immer ein Objekt mit genau einer Liste darin.
 */
function claude_json(
    string $apiKey,
    string $anweisung,
    array $inhalte,
    array $schema,
    string $schluessel,
    int $maxTokens,
): array {
    $rumpf = [
        'model'      => CLAUDE_MODELL,
        'max_tokens' => $maxTokens,
        'system'     => $anweisung,
        'messages'   => [['role' => 'user', 'content' => $inhalte]],
        'output_config' => [
            'format' => [
                'type'   => 'json_schema',
                'schema' => $schema,
            ],
        ],
    ];

    $ch = curl_init(CLAUDE_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 180,
        CURLOPT_HTTPHEADER     => [
            'content-type: application/json',
            'x-api-key: ' . $apiKey,
            'anthropic-version: ' . CLAUDE_VERSION,
        ],
        CURLOPT_POSTFIELDS => json_encode($rumpf, JSON_UNESCAPED_UNICODE),
    ]);

    $antwort = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $fehler = curl_error($ch);
    curl_close($ch);

    if ($antwort === false) {
        error_log('MealMap: Anthropic nicht erreichbar: ' . $fehler);
        fail('Der Dienst ist gerade nicht erreichbar. Bitte später noch einmal.', 502);
    }

    $daten = json_decode($antwort, true);

    if ($status === 401) {
        fail('Der hinterlegte Schlüssel wird nicht akzeptiert. Bitte in den Einstellungen prüfen.', 401);
    }
    if ($status === 429) {
        fail('Zu viele Anfragen auf einmal. Bitte einen Moment warten.', 429);
    }
    if ($status !== 200) {
        $meldung = $daten['error']['message'] ?? 'Unbekannter Fehler';
        error_log("MealMap: Anthropic antwortete $status: $meldung");
        fail('Die Anfrage ist fehlgeschlagen: ' . $meldung, 502);
    }

    // Bei einer Absage steht nichts Verwertbares im Inhalt.
    if (($daten['stop_reason'] ?? '') === 'refusal') {
        fail('Der Inhalt wurde abgelehnt.', 422);
    }

    $text = '';
    foreach ($daten['content'] ?? [] as $block) {
        if (($block['type'] ?? '') === 'text') {
            $text .= $block['text'];
        }
    }

    $ergebnis = json_decode($text, true);
    if (!is_array($ergebnis) || !isset($ergebnis[$schluessel])) {
        error_log('MealMap: unerwartete Antwortform: ' . substr($text, 0, 500));
        fail('Die Antwort war nicht lesbar. Bitte noch einmal versuchen.', 502);
    }

    return $ergebnis[$schluessel];
}
