// Stub for the Napster HTTP API only (fetch to companion-api.napster.com). Records every call.
import { vi } from "vitest";

export const napsterCalls: { method: string; path: string; body: unknown }[] = [];
let mode: "ok" | "timeout" | "409" | "slow" = "ok";
export function napsterMode(m: typeof mode) {
  mode = m;
}

const realFetch = globalThis.fetch;
vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith("https://companion-api.napster.com")) return realFetch(input, init);
  const path = url.replace("https://companion-api.napster.com", "");
  const method = init?.method ?? "GET";
  napsterCalls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : null });
  if (method === "POST" && path.includes("/connections")) {
    if (mode === "timeout") throw new TypeError("fetch failed");
    if (mode === "slow") await new Promise((r) => setTimeout(r, 400));
    if (mode === "409") return new Response(JSON.stringify({ code: "ConcurrentSessionLimitReached" }), { status: 409 });
    return new Response(JSON.stringify({ token: "tok_" + napsterCalls.length, connection: { id: "conn_" + napsterCalls.length } }), { status: 200 });
  }
  if (method === "DELETE" && path.startsWith("/public/connections/")) return new Response("{}", { status: 200 });
  return new Response(JSON.stringify({ items: [] }), { status: 200 });
});
