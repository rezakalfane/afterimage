// Persistence for world state, keyed by player id.
// MemoryStore is for local dev only: on Vercel, instances don't share memory, so a persistent
// store must replace it before the public demo (see HANDOFF.md).
import { newWorld, type WorldState } from "./world";

export interface WorldStore {
  get(playerId: string): Promise<WorldState | null>;
  set(state: WorldState): Promise<void>;
}

class MemoryStore implements WorldStore {
  private map = new Map<string, WorldState>();
  async get(playerId: string) {
    return this.map.get(playerId) ?? null;
  }
  async set(state: WorldState) {
    this.map.set(state.playerId, state);
  }
}

const g = globalThis as unknown as { __afterimageStore?: WorldStore };
export const store: WorldStore = (g.__afterimageStore ??= new MemoryStore());

export async function loadWorld(playerId: string): Promise<WorldState> {
  return (await store.get(playerId)) ?? newWorld(playerId);
}
