import { NextResponse } from "next/server";
import { backend, captchaToken, toResponse } from "@/lib/backend";
import { setSessionCookie } from "@/lib/session";
import { loginSchema } from "@/lib/schemas";

// Langkah 1: cek email dan password. Jika OTP aktif, backend membalas challengeId.
// Jika OTP nonaktif, backend membalas accessToken dan langsung disimpan sebagai cookie.
export async function POST(req: Request) {
  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });
  const result = await backend("/auth/login", {
    method: "POST",
    signed: true,
    body: { ...parsed.data, captchaToken: captchaToken() },
  });

  const data = result.data as { accessToken?: string; expiresIn?: number } | null;
  if (result.ok && data?.accessToken) {
    await setSessionCookie(req, data.accessToken, data.expiresIn ?? 900);
    return NextResponse.json({ ok: true });
  }
  return toResponse(result);
}
