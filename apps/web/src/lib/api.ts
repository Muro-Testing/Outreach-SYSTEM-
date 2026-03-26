const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error ?? `Request failed (${res.status})`);
    (err as Error & { status: number; body: unknown }).status = res.status;
    (err as Error & { status: number; body: unknown }).body = body;
    throw err;
  }
  return (await res.json()) as T;
}
