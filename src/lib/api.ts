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
  /** Bundesland als Kürzel – bestimmt, welche Feiertage gelten. */
  state: string;
  /** Persönliche Gewohnheiten als Freitext, vom Nutzer selbst formuliert. */
  habits: string | null;
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

/** Ein Eintrag im Meal-Prep-Plan. */
export type ApiPlanEntry = {
  id: string;
  cookDate: string | null;
  eatDate: string;
  mealSlot: MealSlotWert;
  recipeId: string | null;
  recipeTitle: string | null;
  freeText: string | null;
  portionCount: number;
  /** Namentlich genannte Mitesser. */
  forWhom: string[];
  /** Weitere Esser ohne Namen, etwa Besuch. */
  guestCount: number;
  /** Woraus die Mahlzeit besteht, wenn sie aus dem Vorrat kommt. */
  fromStock: ApiPlanEntryStock[];
  status: "suggested" | "confirmed";
  isAbsent: boolean;
  cookedAt: string | null;
  eatenAt: string | null;
};

export type MealSlotWert =
  | "breakfast"
  | "snack_am"
  | "lunch"
  | "snack_pm"
  | "dinner"
  | "other";

export type ApiPlanDay = {
  date: string;
  isShoppingDay: boolean;
  note: string | null;
  /** Name des Feiertags, sonst null. Kommt vom Server – die Tabelle der
   *  Feiertage steht nur dort, in api/lib/feiertage.php. */
  holiday: string | null;
  entries: ApiPlanEntry[];
};

/** Ein Kochtermin, der an einem anderen Tag liegt als das Essen. */
export type ApiCookDate = {
  id: string;
  cookDate: string;
  eatDate: string;
  mealSlot: MealSlotWert;
  portionCount: number;
  recipeTitle: string | null;
  cookedAt: string | null;
};

/** Was beim Anlegen und Ändern eines Plan-Eintrags an den Server geht. */
/** Ein Vorratsposten, der zu einer geplanten Mahlzeit gehört. */
export type ApiPlanEntryStock = {
  stockItemId: string;
  name: string;
  portions: number;
  unit: string | null;
  location: string | null;
  /** Wie viel davon noch da ist. Null, wenn der Posten gelöscht wurde. */
  available: number | null;
  /** Gesetzt, sobald abgebucht wurde. */
  consumedAt: string | null;
};

/** Ein Posten im Vorrat. Gezählt wird in Portionen. */
/** Wofür ein Vorratsposten schon eingeplant ist – "SO Nudelsalat". */
export type ApiStockReservation = {
  day: string;
  date: string;
  portions: number;
  unit: string | null;
  what: string;
};

export type ApiStockItem = {
  id: string;
  name: string;
  /** cooked = fertiges Essen in Portionen, ingredient = Zutat in g/Stück. */
  kind: "cooked" | "ingredient";
  storeCategory: StoreCategoryWert;
  icon: string;
  reservedFor: ApiStockReservation[];
  quantity: number;
  unit: string | null;
  location: string | null;
  recipeId: string | null;
  recipeTitle: string | null;
  bestBefore: string | null;
  /** Tage bis zum Haltbarkeitsdatum. Negativ = abgelaufen, null = kein Datum. */
  daysLeft: number | null;
  /** Geschätzte Verderblichkeit: sofort verarbeiten, schnell, oder unkritisch. */
  perishing: "sofort" | "schnell" | "normal";
  /** abgelaufen | bald | ok */
  freshness: "abgelaufen" | "bald" | "ok";
  freshnessNote: string | null;
  createdAt: string;
};

export type StockInput = {
  name: string;
  kind?: "cooked" | "ingredient";
  storeCategory?: StoreCategoryWert;
  quantity: number;
  unit?: string | null;
  location?: string | null;
  recipeId?: string | null;
  bestBefore?: string | null;
};

/** Ein Posten auf der Einkaufsliste. */
export type ApiShoppingItem = {
  id: string;
  name: string;
  /** Sinnbild, serverseitig aus dem Namen geraten. */
  icon: string;
  /** Eigenes Bild – tritt an die Stelle des Sinnbilds. */
  imageUrl: string | null;
  quantity: number | null;
  unit: string | null;
  storeCategory: StoreCategoryWert;
  /** Verderbliche Ware – lohnt einen zweiten Einkauf, wenn sie spät gebraucht wird. */
  perishable: boolean;
  /** Geschätzte Verderblichkeit – Hackfleisch etwa muss am Kauftag verarbeitet werden. */
  perishing: "sofort" | "schnell" | "normal";
  perishingNote: string | null;
  /** Wie viele Tage hin, bis der Posten gebraucht wird. Null ohne Datum. */
  daysAhead: number | null;
  /** Optionaler Laden – Aldi, Lidl, Edeka. Null heißt: egal wo. */
  storeId: string | null;
  storeName: string | null;
  sourceType: "recipe" | "manual";
  status: "open" | "done";
  neededByDate: string | null;
  /**
   * Alle Termine, an denen der Posten gebraucht wird – je Termin mit dem
   * eigenen Grund, falls dort nicht eingekauft werden kann.
   */
  neededDates: { date: string; reason: string | null; buyBy: string }[];
  doneAt: string | null;
  /** Aus welchen Rezepten der Posten stammt. Leer bei Handeingaben. */
  fromRecipes: string[];
};

export type StoreCategoryWert =
  | "produce"
  | "dairy"
  | "meat"
  | "frozen"
  | "dry"
  | "spices"
  | "bakery"
  | "drinks"
  | "household"
  | "other";

/** Was der Vorrat schon abdeckt – steht ausgegraut neben der Liste. */
export type ApiCoveredItem = {
  name: string;
  needed: number | null;
  inStock: number;
  unit: string | null;
  stockName: string;
  fully: boolean;
  remaining: number | null;
  recipes: string[];
};

/** Ein Laden, in dem eingekauft wird. */
export type ApiStore = {
  id: string;
  name: string;
  position?: number;
};

export type ShoppingInput = {
  storeId?: string | null;
  /** Fehlt das Feld, bleibt das Bild stehen; ein leerer String entfernt es. */
  imageUrl?: string | null;
  /** Fehlt das Feld, bleibt das Sinnbild; ein leerer String lässt wieder raten. */
  icon?: string | null;
  name: string;
  quantity?: number | null;
  unit?: string | null;
  storeCategory?: StoreCategoryWert;
  neededByDate?: string | null;
};

export type PlanEntryInput = {
  eatDate: string;
  cookDate?: string | null;
  mealSlot: MealSlotWert;
  recipeId?: string | null;
  freeText?: string | null;
  portionCount?: number;
  forWhom?: string[];
  guestCount?: number;
  /** Woraus die Mahlzeit besteht. Weglassen lässt die Zuordnung unverändert. */
  fromStock?: { stockItemId: string; portions: number }[];
  isAbsent?: boolean;
  status?: "suggested" | "confirmed";
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

  /** Die sechzehn Bundesländer für die Auswahl in den Einstellungen. */
  states: () => request<{ states: { code: string; name: string }[] }>("/states"),

  /** Speichert das Bundesland – es entscheidet über die Feiertage. */
  saveState: (state: string) =>
    request<{ user: ApiUser }>("/user/state", { method: "PUT", body: { state } }),

  /**
   * Speichert die persönlichen Gewohnheiten als Freitext. Der Vorschlagsmotor
   * gibt sie an die KI weiter, statt Annahmen im Code zu treffen.
   */
  saveHabits: (habits: string) =>
    request<{ user: ApiUser }>("/user/habits", {
      method: "PUT",
      body: { habits },
    }),

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

  // --- Plan ---

  plan: (from: string, days = 14) =>
    request<{
      from: string;
      to: string;
      days: ApiPlanDay[];
      cookDates: ApiCookDate[];
    }>(`/plan?from=${from}&days=${days}`),

  createPlanEntry: (input: PlanEntryInput) =>
    request<{ entry: ApiPlanEntry }>("/plan/entries", {
      method: "POST",
      body: input,
    }),

  updatePlanEntry: (id: string, input: PlanEntryInput) =>
    request<{ entry: ApiPlanEntry }>(`/plan/entries/${id}`, {
      method: "PATCH",
      body: input,
    }),

  /**
   * Löscht einen Eintrag. Schon gekaufte Zutaten wandern dabei in den Vorrat –
   * `toStock` sagt, was gebucht wurde.
   */
  deletePlanEntry: (id: string) =>
    request<{
      deleted: boolean;
      toStock: { name: string; quantity: number; unit: string | null }[];
    }>(`/plan/entries/${id}`, { method: "DELETE" }),

  /** Hakt gekocht oder gegessen ab – oder nimmt es zurück. */
  markPlanEntry: (id: string, what: "cooked" | "eaten", value: boolean) =>
    request<{ entry: ApiPlanEntry }>(`/plan/entries/${id}/mark`, {
      method: "PUT",
      body: { what, value },
    }),

  /**
   * Schlägt für eine Woche Rezepte vor. Füllt nur leere Slots – was schon
   * geplant ist, bleibt unangetastet, auch bei mehrfachem Aufruf.
   */
  suggestPlan: (from: string, days = 7) =>
    request<{
      entries: ApiPlanEntry[];
      created: number;
      reason?: "voll" | "keine_rezepte";
    }>("/plan/suggest", { method: "POST", body: { from, days } }),

  /** Verwirft alle unbestätigten Vorschläge eines Zeitraums. */
  clearPlanSuggestions: (from: string, days = 7) =>
    request<{ deleted: number }>(
      `/plan/suggestions?from=${from}&days=${days}`,
      { method: "DELETE" },
    ),

  /** Macht aus einem Vorschlag einen festen Eintrag. */
  confirmPlanEntry: (id: string) =>
    request<{ entry: ApiPlanEntry }>(`/plan/entries/${id}/confirm`, {
      method: "PUT",
    }),

  /**
   * Setzt oder entfernt den Einkaufstag.
   *
   * An einem Feiertag antwortet der Server mit 409 und `needsDecision`, statt
   * es einfach zu tun – erst ein `trotzFeiertag` setzt es durch. Sonntage
   * weist er immer ab.
   */
  // --- Einkaufsliste ---

  shoppingList: () =>
    request<{
      sections: { category: StoreCategoryWert; items: ApiShoppingItem[] }[];
      done: ApiShoppingItem[];
      categories: StoreCategoryWert[];
      freshLeadDays: number;
    }>("/shopping-list"),

  /**
   * Baut die Liste aus dem Plan neu auf. Von Hand hinzugefügte und schon
   * erledigte Posten bleiben stehen.
   *
   * `anyway` enthält Schlüssel, die trotz Vorrat auf die Liste sollen.
   */
  generateShoppingList: (from: string, days = 7, anyway: string[] = []) =>
    request<{
      created: number;
      covered: ApiCoveredItem[];
      skipped: number;
      alreadyBought: number;
    }>(
      "/shopping-list/generate",
      { method: "POST", body: { from, days, anyway } },
    ),

  createShoppingItem: (input: ShoppingInput) =>
    request<{ item: ApiShoppingItem }>("/shopping-list", {
      method: "POST",
      body: input,
    }),

  updateShoppingItem: (id: string, input: ShoppingInput) =>
    request<{ item: ApiShoppingItem }>(`/shopping-list/${id}`, {
      method: "PATCH",
      body: input,
    }),

  toggleShoppingItem: (id: string, done: boolean) =>
    request<{ item: ApiShoppingItem }>(`/shopping-list/${id}/done`, {
      method: "PUT",
      body: { done },
    }),

  deleteShoppingItem: (id: string) =>
    request<{ deleted: boolean }>(`/shopping-list/${id}`, { method: "DELETE" }),

  /** Räumt die erledigten Posten weg – nach dem Einkauf. */
  clearDoneShoppingItems: () =>
    request<{ deleted: number }>("/shopping-list/done", { method: "DELETE" }),

  // --- Läden ---

  stores: () => request<{ stores: ApiStore[] }>("/stores"),

  createStore: (name: string) =>
    request<{ store: ApiStore }>("/stores", { method: "POST", body: { name } }),

  renameStore: (id: string, name: string) =>
    request<{ store: ApiStore }>(`/stores/${id}`, {
      method: "PATCH",
      body: { name },
    }),

  deleteStore: (id: string) =>
    request<{ deleted: boolean }>(`/stores/${id}`, { method: "DELETE" }),

  // --- Vorrat ---

  stock: () =>
    request<{
      items: ApiStockItem[];
      locations: string[];
      unit: string;
      categories: StoreCategoryWert[];
    }>("/stock"),

  createStockItem: (input: StockInput) =>
    request<{ item: ApiStockItem }>("/stock", { method: "POST", body: input }),

  updateStockItem: (id: string, input: StockInput) =>
    request<{ item: ApiStockItem }>(`/stock/${id}`, {
      method: "PATCH",
      body: input,
    }),

  deleteStockItem: (id: string) =>
    request<{ deleted: boolean }>(`/stock/${id}`, { method: "DELETE" }),

  /** Bucht Portionen ab, ohne Umweg über den Plan – aufgegessen, weggeworfen. */
  takeStock: (id: string, quantity: number) =>
    request<{ taken: number; item: ApiStockItem | null }>(`/stock/${id}/take`, {
      method: "PUT",
      body: { quantity },
    }),

  /** Friert ein, was von einem gekochten Eintrag übrig ist. */
  freezePlanEntry: (
    id: string,
    input: { portions: number; name?: string; location?: string; bestBefore?: string },
  ) =>
    request<{ item: ApiStockItem }>(`/plan/entries/${id}/freeze`, {
      method: "POST",
      body: input,
    }),

  setPlanDay: (
    date: string,
    isShoppingDay: boolean,
    optionen?: { note?: string; trotzFeiertag?: boolean },
  ) =>
    request<{ day: { date: string; isShoppingDay: boolean; note: string | null } }>(
      "/plan/day",
      {
        method: "PUT",
        body: {
          date,
          isShoppingDay,
          note: optionen?.note,
          trotzFeiertag: optionen?.trotzFeiertag,
        },
      },
    ),

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
