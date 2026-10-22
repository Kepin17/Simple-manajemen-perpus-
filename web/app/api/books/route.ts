import { cookies } from "next/headers";
import { backend, toResponse, unauthorized } from "@/lib/backend";
import { TOKEN_COOKIE } from "@/lib/constants";

export async function GET() {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return unauthorized();
  return toResponse(await backend("/books", { token }));
}
