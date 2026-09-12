"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, LogOut, Settings, UserRoundCog } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/components/session-provider";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Nutzerwechsel direkt in der Kopfzeile. Bewusst nicht nur in den Einstellungen
 * versteckt – der Wechsel ist ein alltäglicher Griff, keine Einstellung.
 */
export function UserMenu({ className }: { className?: string }) {
  const router = useRouter();
  const { user, setUser } = useSession();
  const [andere, setAndere] = useState<{ id: string; name: string }[]>([]);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    api
      .users()
      .then(({ users }) => setAndere(users.filter((u) => u.id !== user?.id)))
      .catch(() => setAndere([]));
  }, [user?.id, user?.name]);

  if (!user) return null;

  async function wechseln(name: string) {
    setLaeuft(true);
    try {
      const { user: neuer } = await api.signIn(name);
      setUser(neuer);
    } finally {
      setLaeuft(false);
    }
  }

  async function abmelden() {
    setLaeuft(true);
    try {
      await api.signOut();
      setUser(null);
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={laeuft}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
          "text-muted-foreground hover:bg-accent hover:text-foreground",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="grid size-6 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        >
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden sm:inline">{user.name}</span>
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="text-muted-foreground">Angemeldet als</span>
          <br />
          <span className="font-semibold">{user.name}</span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {andere.length > 0 ? (
          <>
            {andere.map((nutzer) => (
              <DropdownMenuItem
                key={nutzer.id}
                onSelect={() => void wechseln(nutzer.name)}
              >
                <UserRoundCog className="size-4" />
                Zu {nutzer.name} wechseln
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        ) : null}

        <DropdownMenuItem onSelect={() => router.push("/einstellungen")}>
          <Settings className="size-4" />
          Einstellungen
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => void abmelden()}>
          <LogOut className="size-4" />
          Abmelden
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
