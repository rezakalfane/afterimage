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
    { id: "photo", rect: { x: 0.37, y: 0.53, w: 0.1, h: 0.1 }, inspect: "photo", action: "inspect_photo" },
    { id: "waterline", rect: { x: 0.79, y: 0.74, w: 0.17, h: 0.11 }, inspect: "archiveReport", action: "inspect_waterline" },
    { id: "projector", rect: { x: 0.03, y: 0.32, w: 0.2, h: 0.36 }, action: "find_future_key" },
    { id: "cabinet", rect: { x: 0.77, y: 0.1, w: 0.2, h: 0.6 }, when: "closed", action: "recover_cache" },
    { id: "cache", rect: { x: 0.79, y: 0.13, w: 0.14, h: 0.34 }, when: "open", inspect: "cache" },
  ],
  1996: [
    { id: "programme", rect: { x: 0.47, y: 0.53, w: 0.1, h: 0.1 }, inspect: "programme", action: "inspect_programme" },
    { id: "hall", rect: { x: 0.31, y: 0.22, w: 0.37, h: 0.28 }, action: "retrieve_key" },
    { id: "cabinet", rect: { x: 0.77, y: 0.1, w: 0.2, h: 0.8 }, when: "closed", action: "open_cabinet" },
    { id: "letter", rect: { x: 0.79, y: 0.5, w: 0.14, h: 0.34 }, when: "open", inspect: "letter", action: "read_letter" },
    { id: "shelf", rect: { x: 0.79, y: 0.13, w: 0.14, h: 0.34 }, when: "open", inspect: "shelf" },
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

/** Names, roles and dates: dictionary (character.*, scene.date1996/2026). */
export const ERA_META: Record<Era, { character: "jeanne" | "malik"; portrait: string }> = {
  1996: { character: "jeanne", portrait: "/assets/afterimage/characters/jeanne-reference" },
  2026: { character: "malik", portrait: "/assets/afterimage/characters/malik-reference" },
};
