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

export type ApiCategory = {
  id: string;
  name: string;
  recipeCount?: number;
};

export type ApiIngredient = {
  id?: string;
  name: string;
  amount: number | null;
  unit: string | null;
};

export type ApiStep = {
  id?: string;
  title: string | null;
  content: string;
  timerSeconds: number | null;
};

/** Ein Rezept in der Liste – nur die Felder, die die Übersicht zeigt. */
export type ApiRecipeSummary = {
  id: string;
  title: string;
  rating: number | null;
  freezable: boolean;
  servings: number;
  prepMinutes: number | null;
  categories: ApiCategory[];
};

export type ApiRecipe = ApiRecipeSummary & {
  notes: string | null;
  comment: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  ingredients: ApiIngredient[];
  steps: ApiStep[];
};

/** Eine geplante oder ausgeführte Änderung an einem Rezept. */
export type ApiChange = {
  art: "menge" | "entfernen" | "ersetzen" | "hinzufuegen" | "unklar";
  text: string;
  zutat?: { id?: string; name: string; unit: string | null };
  menge?: number;
  einheit?: string | null;
  name?: string;
  neuerName?: string;
  grund?: string;
};

/** Was beim Anlegen und Ändern an den Server geht. */
export type RecipeInput = {
  title: string;
  notes?: string;
  freezable: boolean;
  servings: number;
  prepMinutes?: number | null;
  ingredients: { name: string; amount: number | null; unit: string | null }[];
  steps: { title: string | null; content: string; timerSeconds: number | null }[];
  categoryIds: string[];
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Der vollständige Rumpf der Fehlerantwort – etwa für die Rückfrage
     *  beim Löschen einer Kategorie mit enthaltenen Rezepten. */
    readonly data: Record<string, unknown> = {},
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
      typeof data.error === "string"
        ? data.error
        : typeof data.message === "string"
          ? data.message
          : "Etwas ist schiefgelaufen.";
    throw new ApiError(message, response.status, data);
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

  // --- Kategorien ---

  categories: () => request<{ categories: ApiCategory[] }>("/categories"),

  createCategory: (name: string) =>
    request<{ category: ApiCategory }>("/categories", {
      method: "POST",
      body: { name },
    }),

  renameCategory: (id: string, name: string) =>
    request<{ category: ApiCategory }>(`/categories/${id}`, {
      method: "PATCH",
      body: { name },
    }),

  /**
   * Löscht eine Kategorie. Enthält sie Rezepte und ist kein Ziel angegeben,
   * antwortet der Server mit 409 – dann fragt die Oberfläche nach, wohin die
   * Rezepte sollen. Diese Antwort kommt als ApiError mit status 409 zurück.
   */
  deleteCategory: (id: string, moveToCategoryId?: string, force?: boolean) =>
    request<{ deleted: boolean; movedRecipes: number }>(`/categories/${id}`, {
      method: "DELETE",
      body: { moveToCategoryId: moveToCategoryId ?? "", force: force ?? false },
    }),

  // --- Rezepte ---

  recipes: () => request<{ recipes: ApiRecipeSummary[] }>("/recipes"),

  recipe: (id: string) => request<{ recipe: ApiRecipe }>(`/recipes/${id}`),

  createRecipe: (input: RecipeInput) =>
    request<{ recipe: ApiRecipe }>("/recipes", { method: "POST", body: input }),

  updateRecipe: (id: string, input: RecipeInput) =>
    request<{ recipe: ApiRecipe }>(`/recipes/${id}`, {
      method: "PATCH",
      body: input,
    }),

  rateRecipe: (id: string, rating: number | null, comment: string) =>
    request<{ recipe: ApiRecipe }>(`/recipes/${id}/rating`, {
      method: "PUT",
      body: { rating, comment },
    }),

  /**
   * Deutet einen Änderungswunsch („2 statt 3 Eier“). Ohne `apply` wird nur
   * zurückgemeldet, was passieren würde – das Rezept bleibt unangetastet.
   */
  adjustRecipe: (id: string, instruction: string, apply = false) =>
    request<{ changes: ApiChange[]; applied: boolean; recipe?: ApiRecipe }>(
      `/recipes/${id}/adjust`,
      { method: "POST", body: { instruction, apply } },
    ),

  deleteRecipe: (id: string) =>
    request<{ deleted: boolean }>(`/recipes/${id}`, { method: "DELETE" }),
};
