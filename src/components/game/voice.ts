// Voice confirmations. Only the PLAYER's own words (their transcript or typed text) are checked —
// never the model's. A confirmation only acts while the confirmation is on screen (the message
// sheet in review, or a selected ending), through the same UI channel as the button.

const NEGATION = /\b(non|pas|jamais|attends?|attendez|no|not|don'?t|never|wait)\b/i;
const CONFIRM: Record<"fr" | "en", RegExp> = {
  fr: /\b(je (le )?confirme|confirm(e|é|er)|je valide|valid(e|é|er)|c'?est (bien )?(ça|bon)|gardez(-les)?|garde(-les)?|confie(z)?(-les)?|je les confie|d'?accord|oui)\b/i,
  en: /\b(i confirm|confirm(ed)?|i agree|agreed|that'?s (it|right|correct|good)|keep (them|it|these words)|leave them|yes)\b/i,
};

export function normalizeSpeech(text: string): string {
  return text.normalize("NFC").replace(/[’`]/g, "'").toLowerCase();
}

/** An explicit, positive confirmation (no negation in the same sentence). */
export function isConfirmation(text: string, locale: "fr" | "en"): boolean {
  const t = normalizeSpeech(text);
  if (NEGATION.test(t)) return false;
  return CONFIRM[locale].test(t);
}

const ENDINGS: Record<"fr" | "en", [string, RegExp][]> = {
  fr: [
    ["broken_promise", /\b(tout projeter|tout montrer|en entier|intégral|intégrale|version complète|avec l'épilogue)\b/i],
    ["sealed_archive", /\b(archives?|sous scellés?|scellé|ne pas (le )?projeter|conserver le film)\b/i],
    ["public_cut", /\b(version autorisée|autorisée|sans (l')?épilogue|projeter la version)\b/i],
  ],
  en: [
    ["broken_promise", /\b(screen (it )?all|everything|in full|full version|with the epilogue|whole film)\b/i],
    ["sealed_archive", /\b(archives?|under seal|sealed|not screen|keep the film)\b/i],
    ["public_cut", /\b(authori[sz]ed|without the epilogue|screen the version)\b/i],
  ],
};

/** Which ending the player names, if exactly one is named (selection only: confirming is separate). */
export function endingFromSpeech(text: string, locale: "fr" | "en"): string | null {
  const t = normalizeSpeech(text);
  const hits = ENDINGS[locale].filter(([, re]) => re.test(t)).map(([id]) => id);
  return hits.length === 1 ? hits[0] : null;
}
