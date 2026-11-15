// The VHS tape: a pre-recorded video of Jeanne speaking the player's message (Napster Recordings).
// Falls back to a handwritten letter when the Recordings API is not enabled for the organization.
import { CHARACTERS } from "@/lib/content";
import { NapsterError, napster, type RecordingResponse } from "@/lib/napster/api";
import { companionIdFor } from "@/lib/napster/ids";
import { vhsScript, type WorldState } from "@/lib/world/world";

const MIN_CHARS = 84; // Napster: text must be 84–30,000 characters

export async function requestVhs(s: WorldState): Promise<WorldState> {
  const script = vhsScript(s);
  const companionId = companionIdFor("jeanne");
  // content tests guarantee every vhs.template is long enough on its own
  if (!script || !companionId || script.length < MIN_CHARS) return { ...s, vhs: { status: "unavailable", recordingId: null } };
  const text = script;
  try {
    const rec = await napster<RecordingResponse>(`/public/companions/${companionId}/recordings`, {
      method: "POST",
      body: { voiceId: CHARACTERS.jeanne.voiceId, text, tags: { game: "afterimage", player: s.playerId } },
    });
    return { ...s, vhs: { status: "pending", recordingId: rec.id } };
  } catch (e) {
    const notEnabled = e instanceof NapsterError && e.code === "RecordingsApiNotEnabled";
    if (!notEnabled) console.error("[vhs] recording request failed", e);
    return { ...s, vhs: { status: notEnabled ? "unavailable" : "failed", recordingId: null } };
  }
}

/** Poll the recording. Returns the new state and, once ready, a time-limited video URL. */
export async function pollVhs(s: WorldState): Promise<{ state: WorldState; url: string | null }> {
  const companionId = companionIdFor("jeanne");
  if (!companionId || !s.vhs.recordingId) return { state: s, url: null };
  const base = `/public/companions/${companionId}/recordings/${s.vhs.recordingId}`;
  const rec = await napster<RecordingResponse>(base);
  if (rec.status === "failed") return { state: { ...s, vhs: { ...s.vhs, status: "failed" } }, url: null };
  if (rec.status !== "completed") return { state: s, url: null };
  const { url } = await napster<{ url: string }>(`${base}/download-url`);
  return { state: { ...s, vhs: { ...s.vhs, status: "ready" } }, url: url ?? rec.previewUrl };
}
