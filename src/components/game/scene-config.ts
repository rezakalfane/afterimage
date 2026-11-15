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
  /** Label: dictionary scene.hotspots[id]. */
  id: string;
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
    { id: "photo", rect: { x: 0.36, y: 0.56, w: 0.1, h: 0.1 }, inspect: "photo", action: "inspect_photo" },
    { id: "waterline", rect: { x: 0.79, y: 0.74, w: 0.17, h: 0.11 }, inspect: "archiveReport", action: "inspect_waterline" },
    { id: "projector", rect: { x: 0.03, y: 0.32, w: 0.2, h: 0.36 }, action: "find_future_key" },
    { id: "reels", rect: { x: 0.34, y: 0.1, w: 0.36, h: 0.13 }, inspect: "reels" },
    { id: "lamp", rect: { x: 0.6, y: 0.33, w: 0.09, h: 0.16 }, inspect: "lamp" },
    { id: "seats", rect: { x: 0.3, y: 0.24, w: 0.28, h: 0.24 }, inspect: "seats" },
    { id: "cabinet", rect: { x: 0.77, y: 0.1, w: 0.2, h: 0.6 }, when: "closed", action: "recover_cache" },
    { id: "cache", rect: { x: 0.79, y: 0.13, w: 0.14, h: 0.34 }, when: "open", inspect: "cache" },
  ],
  1996: [
    { id: "programme", rect: { x: 0.455, y: 0.56, w: 0.1, h: 0.1 }, inspect: "programme", action: "inspect_programme" },
    { id: "hall", rect: { x: 0.31, y: 0.24, w: 0.28, h: 0.24 }, action: "retrieve_key" },
    { id: "reels", rect: { x: 0.34, y: 0.1, w: 0.36, h: 0.13 }, inspect: "reels" },
    { id: "lamp", rect: { x: 0.6, y: 0.33, w: 0.09, h: 0.16 }, inspect: "lamp" },
    { id: "splicer", rect: { x: 0.29, y: 0.48, w: 0.09, h: 0.1 }, inspect: "splicer" },
    { id: "projector", rect: { x: 0.03, y: 0.32, w: 0.2, h: 0.36 }, inspect: "projector" },
    { id: "cabinet", rect: { x: 0.77, y: 0.1, w: 0.2, h: 0.8 }, when: "closed", action: "open_cabinet" },
    { id: "letter", rect: { x: 0.79, y: 0.5, w: 0.14, h: 0.34 }, when: "open", inspect: "letter", action: "read_letter" },
    { id: "shelf", rect: { x: 0.79, y: 0.13, w: 0.14, h: 0.34 }, when: "open", inspect: "shelf" },
  ],
};

/** Object overlays drawn on top of the scene (DOM images, state-driven, never baked into the scene).
 *  x / w: left edge and width; base: the y where the object RESTS (its contact line), so the object
 *  sits on the desk or the shelf instead of floating. pose: "lie" = flat on a surface (perspective),
 *  "lean" = propped against the back of the cabinet; rot: small in-plane rotation (degrees). */
export interface Overlay { asset: string; x: number; base: number; w: number; pose?: "lie" | "lean" | "stand"; rot?: number }
export const OVERLAYS = {
  // Desk top (both eras share the framing): contact line ≈ 0.655.
  photo2026: { asset: "cinema-photo", x: 0.375, base: 0.655, w: 0.07, pose: "lie", rot: -9 },
  programme1996: { asset: "screening-programme", x: 0.47, base: 0.658, w: 0.068, pose: "lie", rot: 7 },
  // Upper shelf of the crescent cabinet: contact line ≈ 0.478.
  envelopeHigh: { asset: "sealed-envelope", x: 0.792, base: 0.47, w: 0.058, pose: "lean", rot: -7 },
  messageHigh: { asset: "message-paper", x: 0.884, base: 0.47, w: 0.046, pose: "lean", rot: 5 },
  reelHigh: { asset: "film-canister", x: 0.828, base: 0.486, w: 0.074, pose: "stand" },
  letterHigh: { asset: "consent-letter", x: 0.874, base: 0.47, w: 0.054, pose: "lean", rot: 4 },
  // Floor of the lower compartment (1996, before Jeanne stores everything): contact line ≈ 0.84.
  letterInCabinet: { asset: "consent-letter", x: 0.805, base: 0.83, w: 0.065, pose: "lean", rot: -4 },
  reelInCabinet: { asset: "film-canister", x: 0.83, base: 0.848, w: 0.09, pose: "stand" },
} satisfies Record<string, Overlay>;

/** Close-up of the set shown next to a place's text in the inspector (normalized crop). */
export const CLOSEUPS: Record<string, { x: number; y: number; w: number; h: number }> = {
  archiveReport: { x: 0.72, y: 0.56, w: 0.27, h: 0.36 },
  hall: { x: 0.3, y: 0.18, w: 0.42, h: 0.36 },
  cabinet: { x: 0.7, y: 0.06, w: 0.3, h: 0.86 },
  projector: { x: 0.0, y: 0.12, w: 0.3, h: 0.7 },
  shelf: { x: 0.74, y: 0.08, w: 0.24, h: 0.46 },
  reels: { x: 0.3, y: 0.04, w: 0.44, h: 0.24 },
  lamp: { x: 0.55, y: 0.26, w: 0.2, h: 0.32 },
  splicer: { x: 0.26, y: 0.42, w: 0.17, h: 0.2 },
  seats: { x: 0.27, y: 0.18, w: 0.46, h: 0.36 },
  cache: { x: 0.74, y: 0.08, w: 0.24, h: 0.46 },
};

/** Names, roles and dates: dictionary (character.*, scene.date1996/2026). */
export const ERA_META: Record<Era, { character: "jeanne" | "malik"; portrait: string }> = {
  1996: { character: "jeanne", portrait: "/assets/afterimage/characters/jeanne-reference" },
  2026: { character: "malik", portrait: "/assets/afterimage/characters/malik-reference" },
};
