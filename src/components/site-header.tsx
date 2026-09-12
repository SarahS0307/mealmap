"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, navItems, settingsItem } from "@/lib/nav";
import { Logo } from "@/components/logo";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-4xl items-center gap-6 px-4">
        <Link href="/" aria-label="Zur Startseite">
          <Logo />
        </Link>

        {/* Desktop: Hauptnavigation in der Kopfzeile */}
        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive(pathname, item.href)
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href={settingsItem.href}
          aria-label={settingsItem.label}
          aria-current={
            isActive(pathname, settingsItem.href) ? "page" : undefined
          }
          className={cn(
            "ml-auto rounded-md p-2 transition-colors md:ml-0",
            isActive(pathname, settingsItem.href)
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          <settingsItem.icon className="size-5" />
        </Link>
      </div>
    </header>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background md:hidden">
      <div className="mx-auto flex max-w-4xl">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-xs transition-colors",
                active
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <item.icon className={cn("size-5", active && "text-primary")} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
