import { NextResponse } from "next/server";
import { backend, captchaToken, toResponse } from "@/lib/backend";
import { registerSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const parsed = registerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });
  const result = await backend("/auth/register", {
    method: "POST",
    signed: true,
    body: { ...parsed.data, captchaToken: captchaToken() },
  });
  return toResponse(result);
}
