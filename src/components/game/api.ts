"use client";
// Same-origin JSON fetch for the game. Throws { code, message, status, ...body } on error.
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok && res.status !== 422) {
    throw new ApiError(String(data.code ?? res.status), String(data.message ?? "Erreur"), res.status, data);
  }
  return data as T;
}

export function commandId(): string {
  return `ui:${crypto.randomUUID()}`;
}
