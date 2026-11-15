import { initialState, normalizeMessage, transition, type EngineContext, type WorldState } from "@/server/world/engine";

export const ui: EngineContext = { channel: "ui" };
export function apply(s: WorldState, action: string, args: Record<string, unknown> = {}, ctx: EngineContext = ui): WorldState {
  const r = transition(s, { action, args }, ctx);
  if (!r.ok) throw new Error(`${action}: ${r.code}`);
  return r.state;
}
export function ready(message = "Les étoiles restent allumées."): WorldState {
  let s = initialState();
  const steps: [string, Record<string, unknown>?][] = [
    ["inspect_photo"], ["inspect_waterline"], ["switch_era", { era: 1996 }], ["relay_key_location"], ["retrieve_key"], ["open_cabinet"],
    ["inspect_programme"], ["read_letter"], ["acknowledge_permission"], ["relay_flood_warning"], ["write_message", { text: message }],
    ["confirm_message", { text: normalizeMessage(message)! }], ["preserve_cache", { location: "upper_cabinet" }], ["switch_era", { era: 2026 }],
    ["recover_cache"], ["read_message"], ["read_future_letter"],
  ];
  for (const [a, args] of steps) s = apply(s, a, args);
  return s;
}

