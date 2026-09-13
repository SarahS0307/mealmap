"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Timer für einen Zubereitungsschritt.
 *
 * Läuft auf der Uhrzeit, nicht auf einem Zähler: Browser drosseln Timer in
 * Hintergrund-Tabs, ein hochgezählter Wert liefe dann nach. Deshalb wird bei
 * jedem Tick die tatsächlich vergangene Zeit berechnet.
 */
export function CookTimer({ sekunden }: { sekunden: number }) {
  const [rest, setRest] = useState(sekunden);
  const [laeuft, setLaeuft] = useState(false);
  const [fertig, setFertig] = useState(false);
  const endeRef = useRef<number | null>(null);

  useEffect(() => {
    setRest(sekunden);
    setLaeuft(false);
    setFertig(false);
    endeRef.current = null;
  }, [sekunden]);

  useEffect(() => {
    if (!laeuft) return;

    const tick = () => {
      if (endeRef.current === null) return;
      const uebrig = Math.max(0, Math.round((endeRef.current - Date.now()) / 1000));
      setRest(uebrig);
      if (uebrig === 0) {
        setLaeuft(false);
        setFertig(true);
      }
    };

    tick();
    const kennung = window.setInterval(tick, 250);
    return () => window.clearInterval(kennung);
  }, [laeuft]);

  const starten = useCallback(() => {
    endeRef.current = Date.now() + rest * 1000;
    setFertig(false);
    setLaeuft(true);
  }, [rest]);

  const anhalten = useCallback(() => {
    setLaeuft(false);
    endeRef.current = null;
  }, []);

  const zuruecksetzen = useCallback(() => {
    setLaeuft(false);
    setFertig(false);
    setRest(sekunden);
    endeRef.current = null;
  }, [sekunden]);

  const minuten = Math.floor(rest / 60);
  const restSekunden = rest % 60;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3",
        fertig
          ? "border-(--terracotta) bg-(--terracotta)/10"
          : "border-border bg-card",
      )}
    >
      <span
        className={cn(
          "font-mono text-2xl tabular-nums",
          fertig && "text-(--terracotta)",
        )}
        aria-live="polite"
        aria-label={`Noch ${minuten} Minuten und ${restSekunden} Sekunden`}
      >
        {minuten}:{String(restSekunden).padStart(2, "0")}
      </span>

      {fertig ? (
        <span className="font-medium text-(--terracotta)">Zeit ist um</span>
      ) : (
        <Button
          size="sm"
          variant={laeuft ? "outline" : "default"}
          onClick={laeuft ? anhalten : starten}
        >
          {laeuft ? (
            <>
              <Pause className="size-4" />
              Anhalten
            </>
          ) : (
            <>
              <Play className="size-4" />
              {rest === sekunden ? "Timer starten" : "Weiter"}
            </>
          )}
        </Button>
      )}

      {rest !== sekunden || fertig ? (
        <Button size="sm" variant="ghost" onClick={zuruecksetzen} aria-label="Timer zurücksetzen">
          <RotateCcw className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
