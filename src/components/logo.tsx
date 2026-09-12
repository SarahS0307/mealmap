import Image from "next/image";
import { cn } from "@/lib/utils";
import { asset } from "@/lib/paths";

/**
 * Bildmarke aus dem Moodboard: eine stilisierte Kartennadel („Map") mit einem
 * Punkt als Teller-Andeutung („Meal").
 *
 * Eingebunden als PNG aus /public. Quelle ist assets/logo-mark.svg – nach einer
 * Änderung dort `npm run icons` ausführen, das erzeugt PNG-Marke, Favicon und
 * Homescreen-Icon in einem Rutsch.
 *
 * Der Pfad läuft über asset(), weil next/image bei abgeschalteter
 * Bildoptimierung kein basePath voranstellt.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src={asset("/logo-mark.png")}
      alt=""
      width={144}
      height={144}
      priority
      className={cn("size-9 rounded-[0.65rem]", className)}
    />
  );
}

/** Wortmarke: „Meal" in der Textfarbe, „Map" in Terrakotta. */
export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-heading text-xl leading-none font-semibold tracking-tight",
        className,
      )}
    >
      Meal<span className="text-terracotta">Map</span>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <LogoWordmark />
    </span>
  );
}
