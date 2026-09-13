<?php
/**
 * Vorlage für api/config.php – diese Datei kopieren und ausfüllen.
 * Die echte config.php wird nicht eingecheckt, weil sie Zugangsdaten enthält.
 *
 *   cp api/config.example.php api/config.php
 */

return [
    // Datenbank. Lokal die Werte von MAMP, live die aus dem Strato-Kundenbereich.
    'db' => [
        'host'     => '127.0.0.1',
        'port'     => 8889,
        'name'     => 'mealmap',
        'user'     => 'root',
        'password' => 'root',
    ],

    // Wohin hochgeladene Bilder und PDFs gespeichert werden und unter welcher
    // Adresse sie erreichbar sind.
    //   lokal: der Ordner uploads/ im Projekt, erreichbar unter /MealMap/uploads
    //   live:  uploads/ neben der App, erreichbar unter /uploads
    // Der Ordner darf beim Hochladen auf den Server nie mitgelöscht werden.
    'uploads_dir' => __DIR__ . '/../uploads',
    'uploads_url' => '/MealMap/uploads',

    // Zeitzone für PHP. Muss zu der passen, in der MySQL seine Zeitstempel
    // schreibt, sonst gehen Datumsrechnungen daneben.
    'timezone' => 'Europe/Berlin',

    // 'dev' erlaubt Anfragen vom Next-Entwicklungsserver auf Port 3000.
    // Live unbedingt auf 'prod' stellen.
    'env' => 'dev',

    // Herkünfte, die im Entwicklungsmodus zugreifen dürfen. Zusätzlich sind
    // localhost und Adressen im lokalen Netz auf Port 3000/3001 erlaubt,
    // damit das Handy die API erreicht.
    'dev_origins' => ['http://localhost:3000', 'http://localhost:3001'],

    // Ab wann die App nur noch hinterlegte Namen akzeptiert. Solange false,
    // legt jeder neue Name einen Nutzer an – nötig während der Entwicklung.
    'closed_signup' => false,

    // Bei closed_signup = true dürfen sich nur diese Namen anmelden.
    'allowed_names' => ['Sarah'],
];
