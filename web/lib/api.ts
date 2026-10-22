// Pemanggil dari browser ke route handler /api/* milik Next.js. Tidak pernah memanggil backend langsung.
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
  const hasBody = init?.body !== undefined;
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? "GET",
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as { message?: unknown } | null;
  if (!res.ok) {
    // Sesi habis atau tidak valid: kembali ke halaman masuk.
    if (res.status === 401 && !window.location.pathname.startsWith("/masuk")) {
      window.location.href = "/masuk";
    }
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : typeof data?.message === "string"
        ? data.message
        : "Terjadi kesalahan";
    throw new ApiError(message, res.status);
  }
  return data as T;
}
