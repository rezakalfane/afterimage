// Client-side shapes of the server projections (src/server/world/projections.ts). No canon here.
export type Era = 1996 | 2026;
export type Action =
  | "inspect_photo" | "share_photo_note" | "ask_usual_place" | "propose_seat" | "share_report" | "claim_future" | "retrieve_key" | "open_cabinet" | "inspect_programme" | "read_letter"
  | "acknowledge_permission" | "inspect_waterline" | "relay_flood_warning" | "write_message" | "confirm_message"
  | "preserve_cache" | "find_future_key" | "recover_cache" | "close_cabinet" | "read_message" | "read_future_letter" | "choose_ending" | "switch_era" | "request_hint";

export interface NotebookEntry {
  id: string;
  era: Era;
  title: string;
  text: string | null;
  asset: string | null;
}

export interface PublicState {
  revision: number;
  activeEra: Era;
  phase: "investigate" | "preserve" | "recover" | "decide" | "finished";
  objective: string;
  scene: { cabinetOpen1996: boolean; cabinetOpen2026: boolean; reelStoredHigh: boolean; keyInHand1996: boolean };
  notebook: NotebookEntry[];
  message: { draft: string | null; confirmed: string | null; sealed: boolean; recovered: string | null };
  acknowledged: boolean;
  endings: { id: string; label: string; consequence: string; confirmation: string }[];
  ending: string | null;
  closing: string | null;
  hints: { used: number; topic: string | null; levels: Record<string, number> };
  availableActions: Action[];
}

export interface CommandResponse {
  ok: boolean;
  changed?: boolean;
  code?: string;
  message?: string;
  revision: number;
  event?: { type: Action; summary: string } | null;
  hint?: string | null;
  publicState: PublicState;
  reaction?: string | null;
  contextText?: string;
}

export type Mode = "rehearsal" | "live";
