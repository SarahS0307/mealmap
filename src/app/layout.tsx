import type { Metadata } from "next";
import { Fraunces, Work_Sans } from "next/font/google";
import "./globals.css";
import { MobileNav, SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

// Moodboard: Fraunces für Titel und Rezeptnamen, Work Sans für alles Übrige.
const fraunces = Fraunces({
  variable: "--font-fraunces",
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
};

/**
 * Wird nur gesetzt, wenn die App über `npm run sync` hinter dem
 * BrowserSync-Proxy läuft. Der Pfad bleibt relativ, damit er auch über die
 * Netzwerk-URL am Handy auf den Proxy zeigt.
 */
const browserSyncEnabled = process.env.BROWSERSYNC === "1";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body
        className={`${workSans.variable} ${fraunces.variable} flex min-h-screen flex-col antialiased`}
      >
        <SiteHeader />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 pb-28 md:pb-8">
          {children}
        </main>
        <SiteFooter />
        <MobileNav />
        {browserSyncEnabled ? (
          <script src="/browser-sync/browser-sync-client.js" async />
        ) : null}
      </body>
    </html>
  );
}
