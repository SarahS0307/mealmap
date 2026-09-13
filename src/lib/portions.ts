/**
 * Mengen auf eine andere Portionszahl umrechnen.
 *
 * Beim Kochen soll aus „200 g für 4 Portionen“ bei 6 Portionen „300 g“ werden.
 * Gerundet wird sinnvoll statt exakt: Niemand wiegt 133,33 g ab.
 */

/** Rundet je nach Größenordnung auf eine Zahl, die man abmessen kann. */
export function rundeMenge(wert: number): number {
  if (wert >= 100) return Math.round(wert / 5) * 5;
  if (wert >= 20) return Math.round(wert);
  if (wert >= 1) return Math.round(wert * 2) / 2;
  return Math.round(wert * 100) / 100;
}

/**
 * Rechnet eine Menge von der Ausgangsportionszahl auf die gewünschte um.
 * Ohne Menge (z. B. „Salz nach Geschmack“) bleibt null stehen.
 */
export function skaliereMenge(
  menge: number | null,
  vonPortionen: number,
  aufPortionen: number,
): number | null {
  if (menge === null || vonPortionen <= 0) return menge;
  return rundeMenge((menge / vonPortionen) * aufPortionen);
}

/** Zeigt eine Menge lesbar an – halbe Zahlen als ½, ganze ohne Nachkommastellen. */
export function zeigeMenge(menge: number | null): string {
  if (menge === null) return "";
  if (Number.isInteger(menge)) return String(menge);

  const ganz = Math.floor(menge);
  const rest = menge - ganz;
  // Schlüssel mit zwei Nachkommastellen, passend zu toFixed(2) weiter unten –
  // "0.5" würde dort nie treffen, weil toFixed "0.50" liefert.
  const brueche: Record<string, string> = {
    "0.25": "¼",
    "0.33": "⅓",
    "0.50": "½",
    "0.67": "⅔",
    "0.75": "¾",
  };
  const bruch = brueche[rest.toFixed(2)];

  if (bruch) {
    return ganz > 0 ? `${ganz} ${bruch}` : bruch;
  }
  return String(Math.round(menge * 100) / 100);
}
