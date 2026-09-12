import { BookOpen, CalendarDays, Settings, ShoppingCart } from "lucide-react";

/** Hauptnavigation der App. Reihenfolge gilt für Kopfzeile und mobile Leiste. */
export const navItems = [
  { href: "/rezepte", label: "Rezepte", icon: BookOpen },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/einkaufsliste", label: "Einkaufsliste", icon: ShoppingCart },
] as const;

export const settingsItem = {
  href: "/einstellungen",
  label: "Einstellungen",
  icon: Settings,
} as const;

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
