"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rupiah, tanggal } from "@/lib/format";
import { card, errorText, heading } from "@/lib/ui";
import type { Book, Loan } from "@/lib/types";

export function PinjamanAnggotaPage({ memberId }: { memberId: string }) {
  
  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [books, setBooks] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([api<Loan[]>(`/loans?memberId=${memberId}`), api<Book[]>("/books")])
      .then(([l, b]) => {
        setLoans(l);
        setNow(Date.now());
        setBooks(Object.fromEntries(b.map((x) => [x.id, x.title])));
      })
      .catch((e: Error) => setError(e.message));
  }, [memberId]);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-muted">
          <Link href="/" className="underline underline-offset-4">Katalog</Link> / Anggota #{memberId}
        </p>
        <h1 className={`${heading} mt-3`}>Pinjaman anggota</h1>
      </div>

      {error && <p role="alert" className={errorText}>{error}</p>}
      {!loans && !error && <p className="text-muted">Memuat pinjaman...</p>}
      {loans && loans.length === 0 && <p className="text-muted">Anggota ini belum punya riwayat pinjaman.</p>}

      <ul className="space-y-3">
        {loans?.map((l) => {
          const returned = l.returnedAt !== null;
          const late = !returned && now !== null && new Date(l.dueAt).getTime() < now;
          return (
            <li key={l.id} className={card}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-display text-lg font-semibold text-ink">{books[l.bookId] ?? `Buku #${l.bookId}`}</h2>
                <span
                  className={`rounded-full border px-3 py-0.5 text-sm font-medium ${
                    returned ? "border-success/40 text-success" : late ? "border-danger/40 text-danger" : "border-accent/40 text-accent"
                  }`}
                >
                  {returned ? "Dikembalikan" : late ? "Lewat jatuh tempo" : "Dipinjam"}
                </span>
              </div>
              <dl className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-3">
                <div>
                  <dt>Dipinjam</dt>
                  <dd className="font-medium text-ink">{tanggal(l.borrowedAt)}</dd>
                </div>
                <div>
                  <dt>Jatuh tempo</dt>
                  <dd className="font-medium text-ink">{tanggal(l.dueAt)}</dd>
                </div>
                {returned && (
                  <div>
                    <dt>Denda</dt>
                    <dd className="font-medium text-ink">{rupiah(l.lateFee)}</dd>
                  </div>
                )}
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
