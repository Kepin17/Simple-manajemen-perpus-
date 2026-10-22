"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { registerSchema } from "@/lib/schemas";
import { btnPrimary, card, errorText, heading, input, label, successText } from "@/lib/ui";

export default function DaftarPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = registerSchema.safeParse({ email, password });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    try {
      await api("/auth/register", { method: "POST", body: parsed.data });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${card} mx-auto max-w-md space-y-5 p-6 sm:p-8`}>
      <h1 className={heading}>Daftar akun</h1>
      {done ? (
        <div className="space-y-4">
          <p role="status" className={successText}>Akun dibuat. Silakan masuk.</p>
          <Link href="/masuk" className={`${btnPrimary} w-full`}>Ke halaman masuk</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className={label}>Email</label>
            <input id="email" type="email" autoComplete="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="password" className={label}>Password</label>
            <input id="password" type="password" autoComplete="new-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="pwHelp" />
            <p id="pwHelp" className="mt-2 text-sm text-muted">Minimal 12 karakter.</p>
          </div>
          {error && <p role="alert" className={errorText}>{error}</p>}
          <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>{busy ? "Memproses..." : "Daftar"}</button>
        </form>
      )}
    </section>
  );
}
