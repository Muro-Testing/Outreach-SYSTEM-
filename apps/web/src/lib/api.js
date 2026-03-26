const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
function buildApiUrl(path) {
    const normalizedBase = API_BASE.replace(/\/+$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    if (normalizedBase && normalizedPath.startsWith(`${normalizedBase}/`)) {
        return normalizedPath;
    }
    return `${normalizedBase}${normalizedPath}`;
}
export async function api(path, init) {
    const res = await fetch(buildApiUrl(path), {
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
