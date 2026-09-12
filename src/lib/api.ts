/**
 * Zugriff auf die PHP-API.
 *
 * Lokal läuft die Oberfläche auf Port 3000 und die API unter MAMP auf Port 8888,
 * deshalb die vollständige Adresse aus der Umgebungsvariablen. Live liegen beide
 * auf derselben Domain, dort genügt der relative Pfad /api.
 *
 * `credentials: "include"` ist zwingend – ohne das schickt der Browser das
 * Sitzungs-Cookie nicht mit, und jede Anfrage gälte als abgemeldet.
 */
const CONFIGURED = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

/**
 * In der Entwicklung steht {host} in der Adresse. Es wird durch den Rechnernamen
 * ersetzt, über den die Seite gerade geöffnet wurde – am Rechner "localhost",
 * am Handy die Netzwerk-IP. Ohne das zeigte "localhost" vom Handy aus auf das
 * Handy selbst und die API wäre unerreichbar.
 */
function apiBase(): string {
  if (!CONFIGURED.includes("{host}")) {
    return CONFIGURED;
  }
  const host = typeof window === "undefined" ? "localhost" : window.location.hostname;
  return CONFIGURED.replace("{host}", host);
}

export type ApiUser = {
  id: string;
  name: string;
  hasApiKey: boolean;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${apiBase()}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(
      "Keine Verbindung zum Server. Läuft MAMP?",
      0,
    );
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    const message =
      typeof data.error === "string" ? data.error : "Etwas ist schiefgelaufen.";
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export const api = {
  session: () => request<{ user: ApiUser | null }>("/session"),

  signIn: (name: string) =>
    request<{ user: ApiUser }>("/session", { method: "POST", body: { name } }),

  signOut: () => request<{ user: null }>("/session", { method: "DELETE" }),

  users: () => request<{ users: { id: string; name: string }[] }>("/users"),

  rename: (name: string) =>
    request<{ user: ApiUser }>("/user", { method: "PATCH", body: { name } }),

  saveApiKey: (apiKey: string) =>
    request<{ hasApiKey: boolean }>("/user/api-key", {
      method: "PUT",
      body: { apiKey },
    }),
};
