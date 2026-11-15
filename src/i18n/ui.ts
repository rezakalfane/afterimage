// Interface strings, one dictionary per locale. The French dictionary defines the keys;
// every other locale must provide all of them (enforced by the type and by tests).
import type { Locale } from "@/lib/content";

const fr = {
  call: "Appeler",
  hangUp: "Raccrocher",
  connecting: "Connexion…",
  micDenied: "Le micro est nécessaire pour parler aux personnages. Autorisez-le dans le navigateur.",
  yourTurn: "À vous de parler",
  speaking: "{name} vous parle",
  inventory: "Inventaire",
  newGame: "Nouvelle partie",
  language: "Langue",
  era: "Époque",
  pastChanged: "Le passé a changé le présent",
  vhsFound: "La cassette retrouvée",
  vhsRendering: "La cassette se rembobine…",
  letterFound: "Le message retrouvé",
  play: "Lire",
  close: "Fermer",
  errNotProvisioned: "Les personnages ne sont pas encore installés (npm run provision).",
  errTooMany: "Trop de joueurs en même temps. Réessayez dans une minute.",
  errRateLimited: "Un instant… réessayez dans quelques secondes.",
  errSession: "La connexion a échoué. Réessayez.",
  errEnded: "L'appel est terminé.",
  errIdle: "L'appel va se couper faute d'activité.",
  conceptNote: "Maquette technique",
} as const;

export type UiKey = keyof typeof fr;
type Dict = Record<UiKey, string>;

const en: Dict = {
  call: "Call",
  hangUp: "Hang up",
  connecting: "Connecting…",
  micDenied: "The microphone is needed to talk to the characters. Allow it in your browser.",
  yourTurn: "Your turn to speak",
  speaking: "{name} is speaking",
  inventory: "Inventory",
  newGame: "New game",
  language: "Language",
  era: "Era",
  pastChanged: "The past has changed the present",
  vhsFound: "The recovered tape",
  vhsRendering: "The tape is rewinding…",
  letterFound: "The recovered message",
  play: "Play",
  close: "Close",
  errNotProvisioned: "The characters are not installed yet (npm run provision).",
  errTooMany: "Too many players at once. Try again in a minute.",
  errRateLimited: "One moment… try again in a few seconds.",
  errSession: "The connection failed. Please try again.",
  errEnded: "The call has ended.",
  errIdle: "The call will drop due to inactivity.",
  conceptNote: "Technical prototype",
};

export const UI: Record<Locale, Dict> = { fr, en };

export function ui(locale: Locale, key: UiKey, vars: Record<string, string> = {}): string {
  const text = UI[locale]?.[key] ?? fr[key];
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}
