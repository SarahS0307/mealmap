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

export type ApiImage = { id: string; url: string };

/** Eine hochgeladene Datei, noch keinem Rezept zugeordnet. */
export type ApiUpload = {
  url: string;
  dateiname: string;
  mimeType: string;
  art: "bild" | "pdf";
  groesse: number;
};

/** Ein vom Import erkanntes Rezept – noch nicht gespeichert. */
export type ApiImportedRecipe = {
  title: string;
  servings: number;
  prepMinutes: number | null;
  freezable: boolean;
  notes: string | null;
  categories: string[];
  ingredients: { name: string; amount: number | null; unit: string | null }[];
  steps: { title: string | null; content: string; timerSeconds: number | null }[];
};

export type ApiRecipe = ApiRecipeSummary & {
  notes: string | null;
  comment: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  ingredients: ApiIngredient[];
  steps: ApiStep[];
  images: ApiImage[];
};

/** Filter für die Rezeptliste. Alles freiwillig, alles kombinierbar. */
export type RecipeFilter = {
  q?: string;
  category?: string | null;
  freezable?: boolean | null;
  minRating?: number | null;
  maxMinutes?: number | null;
};

/** Ein Rezept im Papierkorb. */
export type ApiTrashedRecipe = {
  id: string;
  title: string;
  deletedAt: string;
  remainingDays: number;
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
  /** Eingebettete Quelle: Link oder Video. */
  sourceUrl?: string | null;
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

  // --- Dateien ---

  /**
   * Lädt eine Datei hoch. Läuft nicht über request(), weil der Rumpf hier
   * multipart ist und der Browser die Kopfzeile selbst setzen muss.
   */
  upload: async (datei: File): Promise<{ file: ApiUpload }> => {
    const daten = new FormData();
    daten.append("file", datei);

    let antwort: Response;
    try {
      antwort = await fetch(`${apiBase()}/uploads`, {
        method: "POST",
        credentials: "include",
        body: daten,
      });
    } catch {
      throw new ApiError("Keine Verbindung zum Server.", 0);
    }

    const text = await antwort.text();
    const inhalt = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (!antwort.ok) {
      throw new ApiError(
        typeof inhalt.error === "string" ? inhalt.error : "Upload fehlgeschlagen.",
        antwort.status,
        inhalt,
      );
    }
    return inhalt as { file: ApiUpload };
  },

  addRecipeImage: (recipeId: string, url: string) =>
    request<{ image: ApiImage }>(`/recipes/${recipeId}/images`, {
      method: "POST",
      body: { url },
    }),

  removeRecipeImage: (recipeId: string, imageId: string) =>
    request<{ deleted: boolean }>(`/recipes/${recipeId}/images/${imageId}`, {
      method: "DELETE",
    }),

  // --- Import ---

  importStatus: () =>
    request<{ available: boolean; reason: string | null }>("/import"),

  /**
   * Liest Rezepte aus einer Quelle, ohne sie zu speichern. Genau eines von
   * text, url oder uploadUrl angeben.
   */
  importRead: (quelle: { text?: string; url?: string; uploadUrl?: string }) =>
    request<{
      recipes: ApiImportedRecipe[];
      sourceUrl: string | null;
      existingCategories: ApiCategory[];
      count: number;
    }>("/import", { method: "POST", body: quelle }),

  // --- Rezepte ---

  /** Kombinierbare Filter für die Rezeptliste. Leere Werte werden weggelassen. */
  recipes: (filter: RecipeFilter = {}) => {
    const p = new URLSearchParams();
    if (filter.q?.trim()) p.set("q", filter.q.trim());
    if (filter.category) p.set("category", filter.category);
    if (filter.freezable !== undefined && filter.freezable !== null) {
      p.set("freezable", filter.freezable ? "1" : "0");
    }
    if (filter.minRating) p.set("minRating", String(filter.minRating));
    if (filter.maxMinutes) p.set("maxMinutes", String(filter.maxMinutes));

    const frage = p.toString();
    return request<{ recipes: ApiRecipeSummary[] }>(
      `/recipes${frage ? `?${frage}` : ""}`,
    );
  },

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

  /** Verschiebt das Rezept in den Papierkorb – es bleibt wiederherstellbar. */
  deleteRecipe: (id: string) =>
    request<{ deleted: boolean; restorableDays: number }>(`/recipes/${id}`, {
      method: "DELETE",
    }),

  trash: () =>
    request<{ recipes: ApiTrashedRecipe[]; retentionDays: number }>(
      "/recipes/trash",
    ),

  restoreRecipe: (id: string) =>
    request<{ restored: boolean; recipe: ApiRecipe }>(`/recipes/${id}/restore`, {
      method: "POST",
    }),

  /** Löscht endgültig. Danach ist das Rezept wirklich weg. */
  purgeRecipe: (id: string) =>
    request<{ purged: boolean }>(`/recipes/${id}/permanent`, {
      method: "DELETE",
    }),
};
