// Scene layout: image variants and hotspots in NORMALIZED image coordinates (0–1), calibrated on
// the four 1672×941 cabin variants of the kit (they share the same framing). The viewport keeps the
// image's exact aspect ratio, so percentages map 1:1 to image pixels (no "cover" reprojection).
// Hotspots carry no secret: they only name places; what happens is decided by the server.
import type { Action, Era } from "./types";

export const SCENE_RATIO = 1672 / 941;

export function sceneImage(era: Era, open: boolean): string {
  return `/assets/afterimage/scenes/scene-${era}-${open ? "open" : "closed"}`;
}
export const objectImage = (asset: string, w: 240 | 640 = 240) => `/assets/afterimage/objects/${asset}-${w}.webp`;

export interface Hotspot {
  id: string;
  label: string;
  rect: { x: number; y: number; w: number; h: number };
  /** Object to inspect (opens the inspector) and/or the action it proposes. */
  inspect?: string;
  action?: Action;
  args?: Record<string, unknown>;
  /** Only shown when the cabinet is open / closed in this variant. */
  when?: "open" | "closed";
}

export const HOTSPOTS: Record<Era, Hotspot[]> = {
  2026: [
    { id: "photo", label: "Photographie sur le bureau", rect: { x: 0.37, y: 0.53, w: 0.1, h: 0.1 }, inspect: "photo", action: "inspect_photo" },
    { id: "waterline", label: "Trace d’humidité au bas de l’armoire", rect: { x: 0.79, y: 0.74, w: 0.17, h: 0.11 }, inspect: "archiveReport", action: "inspect_waterline" },
    { id: "projector", label: "Derrière le projecteur", rect: { x: 0.03, y: 0.32, w: 0.2, h: 0.36 }, action: "recover_cache" },
    { id: "cabinet", label: "Armoire au croissant", rect: { x: 0.77, y: 0.1, w: 0.2, h: 0.6 }, when: "closed", action: "recover_cache" },
    { id: "cache", label: "Étagère haute de l’armoire", rect: { x: 0.79, y: 0.13, w: 0.14, h: 0.34 }, when: "open", inspect: "cache" },
  ],
  1996: [
    { id: "programme", label: "Programme de la séance sur le bureau", rect: { x: 0.47, y: 0.53, w: 0.1, h: 0.1 }, inspect: "programme", action: "inspect_programme" },
    { id: "hall", label: "La salle, par la vitre de projection", rect: { x: 0.31, y: 0.22, w: 0.37, h: 0.28 }, action: "retrieve_key" },
    { id: "cabinet", label: "Armoire au croissant", rect: { x: 0.77, y: 0.1, w: 0.2, h: 0.8 }, when: "closed", action: "open_cabinet" },
    { id: "letter", label: "La lettre dans l’armoire", rect: { x: 0.79, y: 0.5, w: 0.14, h: 0.34 }, when: "open", inspect: "letter", action: "read_letter" },
    { id: "shelf", label: "Étagère haute de l’armoire", rect: { x: 0.79, y: 0.13, w: 0.14, h: 0.34 }, when: "open", inspect: "shelf" },
  ],
};

/** Object overlays drawn on top of the scene (DOM images, state-driven, never baked into the scene). */
export const OVERLAYS = {
  photo2026: { asset: "cinema-photo", rect: { x: 0.385, y: 0.55, w: 0.075 } },
  programme1996: { asset: "screening-programme", rect: { x: 0.485, y: 0.555, w: 0.07 } },
  reelHigh: { asset: "film-canister", rect: { x: 0.81, y: 0.33, w: 0.1 } },
  envelopeHigh: { asset: "sealed-envelope", rect: { x: 0.84, y: 0.27, w: 0.07 } },
  messageHigh: { asset: "message-paper", rect: { x: 0.8, y: 0.25, w: 0.06 } },
  letterInCabinet: { asset: "consent-letter", rect: { x: 0.81, y: 0.62, w: 0.08 } },
  reelInCabinet: { asset: "film-canister", rect: { x: 0.8, y: 0.73, w: 0.11 } },
} as const;

export const ERA_META: Record<Era, { date: string; place: string; character: "jeanne" | "malik"; name: string; role: string; portrait: string }> = {
  1996: { date: "15 novembre 1996 · 21 h 10", place: "Le Régina · cabine de projection", character: "jeanne", name: "Jeanne", role: "Projectionniste — 1996", portrait: "/assets/afterimage/characters/jeanne-reference" },
  2026: { date: "15 novembre 2026 · 21 h 10", place: "Le Régina · cabine de projection", character: "malik", name: "Malik", role: "Archiviste — 2026", portrait: "/assets/afterimage/characters/malik-reference" },
};
