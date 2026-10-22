"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ornament } from "./ornament";
import { ThemeToggle } from "./theme-toggle";
import { api } from "@/lib/api";
import { btnGhost } from "@/lib/ui";

export function SiteHeader() {
  const router = useRouter();

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
        <nav aria-label="Utama" className="flex flex-wrap items-center gap-1 text-sm">
          <Link href="/" className="rounded-md px-3 py-2 text-ink hover:bg-surface">Katalog</Link>
          <Link href="/keterlambatan" className="rounded-md px-3 py-2 text-ink hover:bg-surface">Keterlambatan</Link>
          <ThemeToggle />
          <button type="button" onClick={logout} className={`${btnGhost} px-3 py-1.5 text-sm`}>Keluar</button>
        </nav>
      </div>
    </header>
  );
}
