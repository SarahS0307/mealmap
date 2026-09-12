"use client";

import { MobileNav, SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SignInForm } from "@/components/sign-in-form";
import { useSession } from "@/components/session-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, error } = useSession();

  // Solange die Sitzung geprüft wird, bleibt die Seite absichtlich leer –
  // sonst blitzt die Namensabfrage kurz auf, obwohl jemand angemeldet ist.
  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16">
        <p className="text-center text-muted-foreground">Einen Moment …</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <SignInForm serverError={error} />
      </main>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 pb-28 md:pb-8">
        {children}
      </main>
      <SiteFooter />
      <MobileNav />
    </>
  );
}
