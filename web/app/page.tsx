"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Ornament } from "@/components/ornament";
import { api } from "@/lib/api";
import { card, errorText, heading, input } from "@/lib/ui";
import type { Book } from "@/lib/types";

export default function KatalogPage() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    api<Book[]>("/books").then(setBooks).catch((e: Error) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (books ?? []).filter(
      (b) => !k || b.title.toLowerCase().includes(k) || b.author.toLowerCase().includes(k) || b.isbn.includes(k),
    );
  }, [books, q]);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-(--radius) border border-line bg-surface p-6 sm:p-10">
        <Ornament kind="asanoha" className="absolute -right-4 -top-4 size-40 bg-gold opacity-[0.12]" />
        <p className="text-sm font-medium tracking-wide text-muted">Selamat datang</p>
        <h1 className={`${heading} mt-2`}>Katalog buku</h1>
        <p className="mt-3 max-w-2xl text-muted">Cari judul, penulis, atau ISBN, lalu pinjam buku yang tersedia.</p>
        <label className="mt-6 block max-w-md">
          <span className="sr-only">Cari buku</span>
          <input
            className={input}
            type="search"
            placeholder="Cari judul, penulis, atau ISBN"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </section>

      {error && <p role="alert" className={errorText}>{error}</p>}
      {!books && !error && <p className="text-muted">Memuat katalog...</p>}
      {books && filtered.length === 0 && <p className="text-muted">Tidak ada buku yang cocok.</p>}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((b) => (
          <li key={b.id}>
            <Link href={`/buku/${b.id}`} className={`${card} block h-full transition hover:border-accent`}>
              <h2 className="font-display text-xl font-semibold text-ink">{b.title}</h2>
              <p className="mt-1 text-muted">{b.author}</p>
              <p className="mt-3 text-sm text-muted">ISBN {b.isbn}</p>
              <p className={`mt-3 text-sm font-medium ${b.availableCopies > 0 ? "text-success" : "text-danger"}`}>
                {b.availableCopies > 0 ? `Tersedia ${b.availableCopies} dari ${b.totalCopies}` : "Sedang habis dipinjam"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
