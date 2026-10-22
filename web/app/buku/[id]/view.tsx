"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Ornament } from "@/components/ornament";
import { api } from "@/lib/api";
import { btnGhost, btnPrimary, card, errorText, heading } from "@/lib/ui";
import type { Book } from "@/lib/types";

export function DetailBukuPage({ id }: { id: string }) {
  
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Book>(`/books/${id}`).then(setBook).catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) return <p role="alert" className={errorText}>{error}</p>;
  if (!book) return <p className="text-muted">Memuat buku...</p>;

  const available = book.availableCopies > 0;
  return (
    <article className="relative overflow-hidden rounded-(--radius) border border-line bg-surface p-6 sm:p-10">
      <Ornament kind="megamendung" className="absolute inset-x-0 bottom-0 h-10 bg-gold opacity-[0.1]" />
      <p className="text-sm text-muted">
        <Link href="/" className="underline underline-offset-4">Katalog</Link> / Detail
      </p>
      <h1 className={`${heading} mt-3`}>{book.title}</h1>
      <p className="mt-2 text-lg text-muted">{book.author}</p>

      <dl className="mt-8 grid max-w-xl gap-4 sm:grid-cols-2">
        <div className={card}>
          <dt className="text-sm text-muted">ISBN</dt>
          <dd className="mt-1 font-medium text-ink">{book.isbn}</dd>
        </div>
        <div className={card}>
          <dt className="text-sm text-muted">Stok tersedia</dt>
          <dd className={`mt-1 font-medium ${available ? "text-success" : "text-danger"}`}>
            {book.availableCopies} dari {book.totalCopies} eksemplar
          </dd>
        </div>
      </dl>

      <div className="mt-8 flex flex-wrap gap-3">
        {available ? (
          <Link href={`/pinjam/${book.id}`} className={btnPrimary}>Pinjam buku ini</Link>
        ) : (
          <span className={`${btnPrimary} opacity-50`} aria-disabled="true">Tidak ada stok</span>
        )}
        <Link href="/" className={btnGhost}>Kembali ke katalog</Link>
      </div>
    </article>
  );
}
