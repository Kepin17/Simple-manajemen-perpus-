"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Ornament } from "./ornament";
import { ThemeToggle } from "./theme-toggle";
import { api } from "@/lib/api";
import { btnGhost } from "@/lib/ui";

const AUTH_PAGES = ["/masuk", "/daftar"];

// Menu Katalog aktif juga di halaman detail buku dan form pinjam.
const NAV = [
  { href: "/", label: "Katalog", match: (p: string) => p === "/" || p.startsWith("/buku") || p.startsWith("/pinjam") },
  { href: "/keterlambatan", label: "Keterlambatan", match: (p: string) => p.startsWith("/keterlambatan") },
];

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthPage = AUTH_PAGES.includes(pathname);

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/masuk");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur">
      <Ornament kind="seigaiha" className="h-3 w-full text-gold opacity-80" style={{ maskSize: "40px 12px", WebkitMaskSize: "40px 12px" }} />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
          <Ornament kind="sakura" className="size-6 bg-gold" />
          Perpustakaan
        </Link>
        {/* Belum login: menu dan tombol Keluar disembunyikan, hanya pilihan tema. */}
        <nav aria-label="Utama" className="flex flex-wrap items-center gap-1 text-sm">
          {!isAuthPage &&
            NAV.map(({ href, label, match }) => {
              const active = match(pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-3 py-2 hover:bg-surface ${active ? "bg-surface font-semibold text-ink ring-1 ring-line" : "text-muted hover:text-ink"}`}
                >
                  {label}
                </Link>
              );
            })}
          <ThemeToggle />
          {!isAuthPage && (
            <button type="button" onClick={logout} className={`${btnGhost} px-3 py-1.5 text-sm`}>Keluar</button>
          )}
        </nav>
      </div>
    </header>
  );
}
