// Napster tool (function) definitions, generated from content/world.json.
// All tools are implicit: the browser receives the call and forwards it to /api/world/tool,
// where the canon guardian (src/lib/world) decides the outcome.
import { LOCALE_CODES, WORLD, type ToolName } from "@/lib/content";

export interface ToolDefinition {
  data: { name: ToolName; description: string; parameters: Record<string, unknown> };
  flow: "implicit";
  prompt: string;
}

function locationEnum() {
  const ids = WORLD.locations.map((l) => l.id);
  const legend = WORLD.locations
    .map((l) => `${l.id} = ${LOCALE_CODES.map((c) => l.label[c]).join(" / ")}`)
    .join("; ");
  return { ids, legend };
}

export function toolDefinitions(): Record<ToolName, ToolDefinition> {
  const { ids, legend } = locationEnum();
  const lieu = { type: "string", enum: ids, description: `Location id. ${legend}` };
  return {
    cacher_bobine: {
      data: {
        name: "cacher_bobine",
        description: "Record where Jeanne hides the film reel in the projection booth in 1996.",
        parameters: { type: "object", properties: { lieu }, required: ["lieu"] },
      },
      flow: "implicit",
      prompt:
        "Use only when Jeanne has been convinced and actually hides the reel. Call it silently, then describe the gesture. Do NOT use to merely discuss hiding places.",
    },
    laisser_message: {
      data: {
        name: "laisser_message",
        description: "Record the exact message Jeanne leaves with the reel for the future.",
        parameters: {
          type: "object",
          properties: { texte: { type: "string", description: "The message, exactly as the user dictated it, in the user's language." } },
          required: ["texte"],
        },
      },
      flow: "implicit",
      prompt:
        "Use only after the user dictated a message and you repeated it back and they confirmed. Pass the exact words. If the result says hide_reel_first, explain the message must travel with the reel.",
    },
    fouiller: {
      data: {
        name: "fouiller",
        description: "Search a place in the projection booth in 2026 and report what is really there.",
        parameters: { type: "object", properties: { lieu }, required: ["lieu"] },
      },
      flow: "implicit",
      prompt:
        "Use every time the user asks you to look, search or open somewhere. Before calling, say a few words as you move there. Describe only what the result returns; never invent a find.",
    },
  };
}
