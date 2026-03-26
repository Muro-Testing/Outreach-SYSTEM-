const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8790";
export async function api(path, init) {
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
        err.status = res.status;
        err.body = body;
        throw err;
    }
    return (await res.json());
}
