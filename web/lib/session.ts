import "server-only";
import { cookies } from "next/headers";
import { TOKEN_COOKIE } from "./constants";

// Flag Secure mengikuti protokol request, bukan NODE_ENV. Browser membuang cookie Secure dari http
// (selain localhost), jadi sesi tidak tersimpan dan halaman kembali ke /masuk.
export async function setSessionCookie(req: Request, token: string, maxAge: number) {
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  (await cookies()).set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: proto === "https",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}
