import "server-only";
// Parse a seat proposed by the player ("G7", "G sept", "rangée G, place 7", "septième siège de la
// rangée G", "seat seven in row G"…) into a canonical "<ROW><NUMBER>". Pure; no canon in here
// (the expected seat is checked by the engine, never revealed by this parser).

const WORDS: Record<string, number> = {
  deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12,
  premier: 1, premiere: 1, deuxieme: 2, second: 2, seconde: 2, troisieme: 3, quatrieme: 4, cinquieme: 5, sixieme: 6, septieme: 7, huitieme: 8, neuvieme: 9, dixieme: 10,
  two: 2, three: 3, four: 4, five: 5, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  first: 1, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
};

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(\d+)\s*(?:e|eme|er|th|st|nd|rd)\b/g, "$1")
    .replace(/\b[a-z]+\b/g, (w) => (w in WORDS ? String(WORDS[w]) : w))
    .trim();
}

export function parseSeat(text: unknown): string | null {
  if (typeof text !== "string" || text.length > 200) return null;
  const t = ` ${normalize(text)} `;
  const SEAT = "(?:place|siege|seat|fauteuil|chair|numero|number|no|n)";
  const ROW = "(?:rangee|rang|row|range)";
  // Row + number in either order, possibly separated by a few small words ("de la", "in", "number").
  const row = new RegExp(`\\b${ROW}\\s+([a-z])\\b`).exec(t)?.[1];
  const num =
    new RegExp(`\\b${SEAT}\\s+(\\d{1,2})\\b`).exec(t)?.[1] ??
    new RegExp(`\\b(\\d{1,2})\\s+(?:${SEAT})\\b`).exec(t)?.[1];
  if (row && num) return `${row.toUpperCase()}${Number(num)}`;
  // Compact form: a single letter directly followed by a number ("g7", "g 7", "g-7").
  const compact = /\b([a-z])\s?(\d{1,2})\b/.exec(t);
  if (compact) return `${compact[1].toUpperCase()}${Number(compact[2])}`;
  return null;
}
