import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { backend, toResponse, unauthorized } from "@/lib/backend";
import { TOKEN_COOKIE } from "@/lib/constants";
import { idSchema } from "@/lib/schemas";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return unauthorized();
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ message: id.error.issues[0].message }, { status: 400 });
  return toResponse(await backend(`/books/${id.data}`, { token }));
}
