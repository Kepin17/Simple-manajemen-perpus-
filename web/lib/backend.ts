import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { DEV_CAPTCHA_TOKEN } from "./constants";

// Hanya dipakai di route handler (server). SIGNING_SECRET tidak pernah ikut ke bundel klien.
const BACKEND_URL = process.env.BACKEND_URL;
const SIGNING_SECRET = process.env.SIGNING_SECRET;

export type BackendResult = { ok: boolean; status: number; data: unknown };

type Options = {
  method?: "GET" | "POST";
  body?: unknown;
  token?: string;
  // Endpoint /auth/* wajib membawa tanda tangan request.
  signed?: boolean;
};

export async function backend(path: string, { method = "GET", body, token, signed = false }: Options = {}): Promise<BackendResult> {
  if (!BACKEND_URL || (signed && !SIGNING_SECRET)) {
    return { ok: false, status: 500, data: { message: "Konfigurasi server web belum lengkap" } };
  }

  const raw = body === undefined ? "" : JSON.stringify(body);
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  if (signed) {
    // Sama dengan signRequest() di backend: METHOD, path, timestamp, nonce, sha256(body), lalu HMAC.
    const timestamp = String(Date.now());
    const nonce = randomBytes(16).toString("hex");
    const bodyHash = createHash("sha256").update(raw).digest("hex");
    const canonical = [method, path, timestamp, nonce, bodyHash].join("\n");
    headers["X-Timestamp"] = timestamp;
    headers["X-Nonce"] = nonce;
    headers["X-Signature"] = createHmac("sha256", SIGNING_SECRET!).update(canonical).digest("hex");
  }

  try {
    const res = await fetch(BACKEND_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : raw,
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text || "Respons backend tidak valid" };
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 502, data: { message: "Backend tidak dapat dihubungi" } };
  }
}

export function toResponse({ status, data }: BackendResult) {
  return NextResponse.json(data ?? null, { status });
}

export function captchaToken() {
  return process.env.CAPTCHA_TOKEN || DEV_CAPTCHA_TOKEN;
}

export function unauthorized() {
  return NextResponse.json({ message: "Unauthorized", statusCode: 401 }, { status: 401 });
}
