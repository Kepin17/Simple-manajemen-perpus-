"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { tanggal } from "@/lib/format";
import { borrowSchema } from "@/lib/schemas";
import { btnPrimary, card, errorText, heading, input, label, successText } from "@/lib/ui";
import type { Book, Loan } from "@/lib/types";

export function PinjamPage({ id }: { id: string }) {
  
  const [book, setBook] = useState<Book | null>(null);
  const [memberId, setMemberId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Book>(`/books/${id}`).then(setBook).catch((e: Error) => setError(e.message));
  }, [id]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = borrowSchema.safeParse({ bookId: id, memberId });
    if (!parsed.success) return setError(parsed.error.issues[0].message);

    setBusy(true);
    try {
      setLoan(await api<Loan>("/loans", { method: "POST", body: parsed.data }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }

  if (loan) {
    return (
      <section className={`${card} max-w-xl space-y-4`}>
        <h1 className={heading}>Peminjaman berhasil</h1>
        <p role="status" className={successText}>
          Buku dipinjam untuk anggota #{loan.memberId}. Jatuh tempo {tanggal(loan.dueAt)}.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={`/anggota/${loan.memberId}`} className={btnPrimary}>Lihat pinjaman anggota</Link>
          <Link href="/" className="inline-flex items-center rounded-lg border border-line px-4 py-2 text-ink">Katalog</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-xl space-y-6">
      <div>
        <p className="text-sm text-muted">
          <Link href={`/buku/${id}`} className="underline underline-offset-4">Detail buku</Link> / Pinjam
        </p>
        <h1 className={`${heading} mt-3`}>Pinjam buku</h1>
        {book && <p className="mt-2 text-muted">{book.title} · tersedia {book.availableCopies} eksemplar</p>}
      </div>

      <form onSubmit={submit} className={`${card} space-y-4`} noValidate>
        <div>
          <label htmlFor="memberId" className={label}>Pilih anggota (ID)</label>
          <input
            id="memberId"
            className={input}
            inputMode="numeric"
            placeholder="Contoh: 12"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            aria-describedby="memberHelp"
            required
          />
          <p id="memberHelp" className="mt-2 text-sm text-muted">
            API belum punya daftar anggota, jadi masukkan ID anggota yang sudah terdaftar.
          </p>
        </div>
        {error && <p role="alert" className={errorText}>{error}</p>}
        <button type="submit" className={btnPrimary} disabled={busy || !book || book.availableCopies < 1}>
          {busy ? "Memproses..." : "Pinjam sekarang"}
        </button>
      </form>
    </section>
  );
}
