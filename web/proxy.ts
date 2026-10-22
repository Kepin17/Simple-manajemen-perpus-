import { NextResponse, type NextRequest } from "next/server";
import { TOKEN_COOKIE } from "@/lib/constants";

const PUBLIC_PAGES = ["/masuk", "/daftar"];

// Cek kehadiran cookie saja. Validitas JWT dicek backend di setiap panggilan API.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PAGES.includes(pathname) || req.cookies.has(TOKEN_COOKIE)) return NextResponse.next();
  const url = new URL("/masuk", req.url);
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|ornament/).*)"],
};
