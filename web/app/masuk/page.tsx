"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Ornament } from "@/components/ornament";
import { PasswordField } from "@/components/password-field";
import { api, ApiError } from "@/lib/api";
import { loginSchema, otpSchema } from "@/lib/schemas";
import { btnPrimary, card, errorText, heading, input, label } from "@/lib/ui";

// Hanya path internal yang boleh dijadikan tujuan setelah masuk.
function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next") ?? "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function MasukPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function kirimLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    let redirecting = false;
    try {
      const res = await api<{ challengeId?: string; ok?: boolean }>("/auth/login", { method: "POST", body: parsed.data });
      // OTP nonaktif: cookie sudah terpasang oleh route login, langsung ke halaman tujuan.
      if (res.ok) {
        redirecting = true;
        window.location.href = nextPath();
        return;
      }
      setChallengeId(res.challengeId ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Terjadi kesalahan");
    } finally {
      // Saat pindah halaman tombol tetap nonaktif, supaya tidak terkirim dua kali.
      if (!redirecting) setBusy(false);
    }
  }

  async function kirimOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = otpSchema.safeParse({ challengeId, code });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    let redirecting = false;
    try {
      await api("/auth/otp", { method: "POST", body: parsed.data });
      // Navigasi penuh, bukan router.replace: halaman yang di-prefetch sebelum login bisa membawa redirect lama.
      redirecting = true;
      window.location.href = nextPath();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Terjadi kesalahan");
    } finally {
      if (!redirecting) setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-4xl items-center">
    <div className="grid w-full gap-8 md:grid-cols-[1fr_1.1fr] md:items-stretch">
      <aside className="relative hidden overflow-hidden rounded-(--radius) border border-line bg-surface p-8 md:flex md:flex-col md:justify-center">
        <Ornament kind="seigaiha" className="absolute inset-x-0 top-0 h-6 bg-gold opacity-40" style={{ maskSize: "40px 20px" }} />
        <Ornament kind="parang" className="absolute inset-0 bg-gold opacity-[0.06]" />
        <h2 className={`${heading} relative`}>Selamat datang</h2>
        <p className="relative mt-3 text-muted">Kelola katalog, peminjaman, dan keterlambatan buku dari satu tempat.</p>
      </aside>

      <section className={`${card} space-y-5 p-6 sm:p-8`}>
        <h1 className="font-display text-2xl font-semibold text-ink">Masuk</h1>
        {!challengeId ? (
          <form onSubmit={kirimLogin} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className={label}>Email</label>
              <input id="email" type="email" autoComplete="email" autoFocus placeholder="nama@contoh.com" disabled={busy} className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="password" className={label}>Password</label>
              <PasswordField id="password" autoComplete="current-password" placeholder="Password akun Anda" disabled={busy} value={password} onChange={setPassword} />
            </div>
            {error && <p role="alert" className={errorText}>{error}</p>}
            <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>{busy ? "Memproses..." : "Masuk"}</button>
            <p className="text-center text-sm text-muted">
              Belum punya akun? <Link href="/daftar" className="font-medium text-accent underline underline-offset-4">Daftar</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={kirimOtp} className="space-y-4" noValidate>
            <div>
              <label htmlFor="code" className={label}>Kode OTP (6 digit)</label>
              <input id="code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} placeholder="000000" disabled={busy} className={`${input} tracking-[0.4em]`} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              <p className="mt-2 text-sm text-muted">Kode berlaku 5 menit dan hanya bisa dipakai sekali.</p>
            </div>
            {error && <p role="alert" className={errorText}>{error}</p>}
            <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>{busy ? "Memverifikasi..." : "Verifikasi"}</button>
            <button type="button" className="w-full text-sm text-muted underline underline-offset-4" onClick={() => { setChallengeId(null); setCode(""); setError(null); }}>
              Ganti email atau password
            </button>
          </form>
        )}
      </section>
    </div>
    </div>
  );
}
