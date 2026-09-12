/**
 * Feste Wertelisten des Datenmodells.
 *
 * Diese Felder liegen als VARCHAR in der Datenbank statt als ENUM, damit neue
 * Werte ohne Schemaänderung dazukommen können. Hier stehen die erlaubten Werte
 * einmal zentral – für die Typprüfung im Code und für die Beschriftung in der
 * Oberfläche. Gegenstück: die Kommentare in api/schema.sql.
 */

export const MEAL_SLOTS = [
  "breakfast",
  "snack_am",
  "lunch",
  "snack_pm",
  "dinner",
  "other",
] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Frühstück",
  snack_am: "Snack vormittags",
  lunch: "Mittagessen",
  snack_pm: "Snack nachmittags",
  dinner: "Abendessen",
  other: "Sonstiges",
};

export const PLAN_STATUS = ["suggested", "confirmed"] as const;
export type PlanStatus = (typeof PLAN_STATUS)[number];

export const STORE_CATEGORIES = [
  "produce",
  "dairy",
  "meat",
  "frozen",
  "dry",
  "bakery",
  "drinks",
  "household",
  "other",
] as const;
export type StoreCategory = (typeof STORE_CATEGORIES)[number];

export const STORE_CATEGORY_LABELS: Record<StoreCategory, string> = {
  produce: "Obst & Gemüse",
  dairy: "Milchprodukte",
  meat: "Fleisch & Fisch",
  frozen: "Tiefkühl",
  dry: "Trockenware",
  bakery: "Backwaren",
  drinks: "Getränke",
  household: "Haushalt",
  other: "Sonstiges",
};

export const SHOPPING_STATUS = ["open", "done"] as const;
export type ShoppingStatus = (typeof SHOPPING_STATUS)[number];

export const SOURCE_TYPES = ["video", "link"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
