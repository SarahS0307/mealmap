"use client";

import { ExternalLink, Play } from "lucide-react";

/**
 * Zeigt die Quelle eines Rezepts.
 *
 * Videos von YouTube und Vimeo werden eingebettet. TikTok und Instagram lassen
 * sich nicht zuverlässig einbetten, ohne deren Skripte zu laden – dort steht
 * deshalb ein deutlich gekennzeichneter Link. Beim Drucken fällt der Abschnitt
 * weg, auf Papier nützt er nichts.
 */
export function RecipeSource({
  url,
  type,
}: {
  url: string;
  type: string | null;
}) {
  const eingebettet = einbettungsAdresse(url);

  if (eingebettet) {
    return (
      <section className="space-y-2" data-print="aus">
        <h2 className="font-heading text-xl font-semibold">Quelle</h2>
        <div className="aspect-video overflow-hidden rounded-xl border border-border">
          <iframe
            src={eingebettet}
            title="Video zum Rezept"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="size-full"
          />
        </div>
      </section>
    );
  }

  const Icon = type === "video" ? Play : ExternalLink;

  return (
    <section className="space-y-2" data-print="aus">
      <h2 className="font-heading text-xl font-semibold">Quelle</h2>
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-primary/40 hover:bg-accent"
      >
        <Icon className="size-4 shrink-0 text-primary" />
        <span className="truncate">{lesbareAdresse(url)}</span>
      </a>
    </section>
  );
}

/** Baut die Einbettungsadresse für Portale, die das ohne Skript erlauben. */
function einbettungsAdresse(url: string): string | null {
  try {
    const adresse = new URL(url);
    const host = adresse.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = adresse.searchParams.get("v");
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "youtu.be") {
      const id = adresse.pathname.slice(1);
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "vimeo.com") {
      const id = adresse.pathname.split("/").filter(Boolean)[0];
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    // Keine gültige Adresse – dann eben als Link.
  }
  return null;
}

/** Kürzt eine Adresse auf das, was man lesen will. */
function lesbareAdresse(url: string): string {
  try {
    const adresse = new URL(url);
    return adresse.hostname.replace(/^www\./, "") + adresse.pathname;
  } catch {
    return url;
  }
}
