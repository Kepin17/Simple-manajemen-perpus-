import { NextResponse } from "next/server";
import { backend, captchaToken, toResponse } from "@/lib/backend";
import { loginSchema } from "@/lib/schemas";

// Langkah 1: cek email dan password, backend mengirim OTP dan membalas challengeId.
export async function POST(req: Request) {
  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });
  const result = await backend("/auth/login", {
    method: "POST",
    signed: true,
    body: { ...parsed.data, captchaToken: captchaToken() },
  });
  return toResponse(result);
}
