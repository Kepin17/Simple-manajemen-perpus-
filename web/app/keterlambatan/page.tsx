"use client";

import { useEffect, useState } from "react";
import { Ornament } from "@/components/ornament";
import { api } from "@/lib/api";
import { normalizeWhatsapp, rupiah, tanggal, waLink } from "@/lib/format";
import { btnGhost, card, errorText, heading } from "@/lib/ui";
import type { OverdueLoan } from "@/lib/types";

// Tombol hanya membuka tautan wa.me di tab baru. Pesan dikirim sendiri oleh petugas.
function pesan(l: OverdueLoan) {
  return `Halo ${l.memberName}, buku "${l.bookTitle}" sudah melewati jatuh tempo pada ${tanggal(
    l.dueAt,
  )} dengan denda ${rupiah(l.lateFee)}. Mohon segera dikembalikan. Terima kasih, Perpustakaan.`;
}

export default function KeterlambatanPage() {
  const [loans, setLoans] = useState<OverdueLoan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<OverdueLoan[]>("/loans/overdue").then(setLoans).catch((e: Error) => setError(e.message));
  }, []);

  const totalDenda = loans?.reduce((sum, l) => sum + l.lateFee, 0) ?? 0;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-(--radius) border border-line bg-surface p-6 sm:p-10">
        <Ornament kind="megamendung" className="absolute inset-x-0 bottom-0 h-12 bg-gold opacity-[0.12]" />
        <h1 className={heading}>Daftar keterlambatan</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Pinjaman yang belum dikembalikan dan sudah lewat jatuh tempo. Denda dihitung oleh backend.
        </p>
        {loans && (
          <p className="mt-4 text-sm font-medium text-ink">
            {loans.length} pinjaman terlambat · total denda {rupiah(totalDenda)}
          </p>
        )}
      </section>

      {error && <p role="alert" className={errorText}>{error}</p>}
      {!loans && !error && <p className="text-muted">Memuat data...</p>}
      {loans && loans.length === 0 && <p className="text-muted">Tidak ada keterlambatan saat ini.</p>}

      <ul className="space-y-3">
        {loans?.map((l) => {
          const phone = normalizeWhatsapp(l.memberWhatsapp);
          return (
            <li key={l.id} className={`${card} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
              <div className="min-w-0 space-y-1">
                <h2 className="font-display text-lg font-semibold text-ink">{l.memberName}</h2>
                <p className="text-muted">{l.bookTitle}</p>
                <p className="text-sm text-muted">Jatuh tempo {tanggal(l.dueAt)}</p>
                <p className="text-sm font-semibold text-danger">Denda {rupiah(l.lateFee)}</p>
              </div>
              {phone ? (
                <a
                  href={waLink(phone, pesan(l))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${btnGhost} shrink-0`}
                  aria-label={`Hubungi ${l.memberName} via WhatsApp, membuka tab baru`}
                >
                  Hubungi via WhatsApp
                </a>
              ) : (
                <span className="text-sm text-muted">Nomor WhatsApp belum tersedia</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
