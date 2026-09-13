import type { Metadata } from "next";
import { Outfit, Work_Sans } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/session-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";

// Moodboard: Outfit für Titel und Rezeptnamen, Work Sans für alles Übrige.
// Bewusst serifenlos – geometrisch und freundlich statt editorial.
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MealMap",
  description: "Rezepte, Meal-Prep-Plan und Einkaufsliste an einem Ort.",
  // Private App – soll in keiner Suchmaschine auftauchen.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

/**
 * Adresse des BrowserSync-Clients, gesetzt von `npm run watch`.
 *
 * BrowserSync liefert die Seite nicht aus – das macht Apache. Es meldet dem
 * Browser nur, wenn neu gebaut wurde, damit die Seite sich selbst neu lädt.
 * Deshalb bleibt die gewohnte Adresse localhost:8888/MealMap/ bestehen.
 *
 * {host} wird durch den Rechnernamen ersetzt, über den die Seite geöffnet
 * wurde – am Handy also die Netzwerk-IP statt localhost.
 */
const browserSyncUrl = process.env.NEXT_PUBLIC_BROWSERSYNC_URL ?? "";

/**
 * Setzt die Farbschema-Klasse, bevor die Seite gezeichnet wird. Ohne diesen
 * Schritt blitzt bei gewähltem Dunkelmodus für einen Moment die helle Fassung
 * auf, weil React erst nach dem ersten Bild übernimmt.
 */
const themeSkript = `try{var t=localStorage.getItem("mealmap-theme");if(t==="dark"||t==="light"){document.documentElement.classList.add(t)}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Die Schrift-Variablen gehören an <html>, nicht an <body>: Die Regel
    // `font-sans` greift auf <html> zu, und eine dort unbekannte Variable macht
    // die ganze font-family ungültig – der Browser fiele auf Serif zurück.
    <html lang="de" className={`${workSans.variable} ${outfit.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeSkript }} />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <ThemeProvider>
          <SessionProvider>
            <AppShell>{children}</AppShell>
          </SessionProvider>
        </ThemeProvider>
        {browserSyncUrl ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){var u=${JSON.stringify(browserSyncUrl)}.replace("{host}",location.hostname);var s=document.createElement("script");s.src=u;s.async=true;document.head.appendChild(s)})()`,
            }}
          />
        ) : null}
      </body>
    </html>
  );
}
