import { NextResponse } from "next/server";
import { backend } from "@/lib/backend";
import { setSessionCookie } from "@/lib/session";
import { otpSchema } from "@/lib/schemas";

// Langkah 2: tukar OTP dengan JWT. JWT hanya disimpan di cookie httpOnly, tidak dikirim ke browser.
export async function POST(req: Request) {
  const parsed = otpSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });

  const result = await backend("/auth/otp/verify", { method: "POST", signed: true, body: parsed.data });
  const data = result.data as { accessToken?: string; expiresIn?: number } | null;
  if (!result.ok || !data?.accessToken) return NextResponse.json(result.data, { status: result.status });

  await setSessionCookie(req, data.accessToken, data.expiresIn ?? 900);
  return NextResponse.json({ ok: true });
}
