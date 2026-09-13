/**
 * Datumshilfen für den Plan.
 *
 * Datumsangaben laufen als YYYY-MM-DD durch die App. Bewusst keine
 * Date-Objekte für die Rechnung: Ein `new Date("2026-09-13")` liegt in UTC,
 * und je nach Zeitzone springt die Anzeige dann einen Tag zurück.
 */

export function heute(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Verschiebt ein Datum um Tage, ohne den Umweg über die Zeitzone. */
export function plusTage(datum: string, tage: number): string {
  const [j, m, t] = datum.split("-").map(Number);
  const d = new Date(j, m - 1, t + tage);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

const WOCHENTAGE = [
  "Sonntag", "Montag", "Dienstag", "Mittwoch",
  "Donnerstag", "Freitag", "Samstag",
];
const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function alsDate(datum: string): Date {
  const [j, m, t] = datum.split("-").map(Number);
  return new Date(j, m - 1, t);
}

export function wochentag(datum: string): string {
  return WOCHENTAGE[alsDate(datum).getDay()];
}

/** "13. September" – das Jahr nur, wenn es nicht das laufende ist. */
export function zeigeDatum(datum: string): string {
  const d = alsDate(datum);
  const jahr = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${d.getDate()}. ${MONATE[d.getMonth()]}${jahr}`;
}

/** "heute", "morgen", "gestern" – sonst der Wochentag. */
export function relativerTag(datum: string): string {
  if (datum === heute()) return "heute";
  if (datum === plusTage(heute(), 1)) return "morgen";
  if (datum === plusTage(heute(), -1)) return "gestern";
  return wochentag(datum);
}

/**
 * "heute", "morgen", "gestern" – sonst nichts.
 * Für Überschriften, die den Wochentag ohnehin schon nennen.
 */
export function relativeMarke(datum: string): string | null {
  if (datum === heute()) return "heute";
  if (datum === plusTage(heute(), 1)) return "morgen";
  if (datum === plusTage(heute(), -1)) return "gestern";
  return null;
}

export function istVergangen(datum: string): boolean {
  return datum < heute();
}

/** Reine Wochentagsfrage – Feiertage kennt nur der Server. */
export function istSonntag(datum: string): boolean {
  const [j, m, t] = datum.split("-").map(Number);
  return new Date(j, m - 1, t).getDay() === 0;
}

/**
 * Der Montag der Woche, in der das Datum liegt.
 * Wochen fangen hier immer montags an – nie sonntags.
 */
export function montag(datum: string): string {
  const [j, m, t] = datum.split("-").map(Number);
  const d = new Date(j, m - 1, t);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Erster Tag des Monats, in dem das Datum liegt. */
export function monatsAnfang(datum: string): string {
  const [j, m] = datum.split("-").map(Number);
  return `${j}-${String(m).padStart(2, "0")}-01`;
}

/** Verschiebt um ganze Monate, ohne über den Monatsletzten zu stolpern. */
export function plusMonate(datum: string, monate: number): string {
  const [j, m] = datum.split("-").map(Number);
  const d = new Date(j, m - 1 + monate, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Anzahl der Tage im Monat. */
export function tageImMonat(datum: string): number {
  const [j, m] = datum.split("-").map(Number);
  return new Date(j, m, 0).getDate();
}

/**
 * Wochentag als Spaltennummer, Montag = 0.
 * Kalender beginnen hierzulande am Montag, JavaScript zählt ab Sonntag.
 */
export function spalte(datum: string): number {
  const [j, m, t] = datum.split("-").map(Number);
  return (new Date(j, m - 1, t).getDay() + 6) % 7;
}

const MONATE_LANG = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export function zeigeMonat(datum: string): string {
  const [j, m] = datum.split("-").map(Number);
  return `${MONATE_LANG[m - 1]} ${j}`;
}
