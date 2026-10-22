import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { backend, toResponse, unauthorized } from "@/lib/backend";
import { TOKEN_COOKIE } from "@/lib/constants";
import { borrowSchema, idSchema } from "@/lib/schemas";

// GET: pinjaman satu anggota (backend mewajibkan memberId).
export async function GET(req: Request) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return unauthorized();
  const memberId = idSchema.safeParse(new URL(req.url).searchParams.get("memberId"));
  if (!memberId.success) return NextResponse.json({ message: memberId.error.issues[0].message }, { status: 400 });
  return toResponse(await backend(`/loans?memberId=${memberId.data}`, { token }));
}

// POST: pinjam buku untuk anggota.
export async function POST(req: Request) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return unauthorized();
  const parsed = borrowSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });
  return toResponse(await backend("/loans", { method: "POST", token, body: parsed.data }));
}
