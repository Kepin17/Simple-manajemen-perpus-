# Perpustakaan

Sistem manajemen peminjaman buku perpustakaan: katalog buku, anggota, peminjaman, pengembalian, denda keterlambatan, dan tautan WhatsApp untuk menghubungi peminjam yang terlambat.

- **Backend**: NestJS 11 yang dijalankan dengan Bun, PostgreSQL 16 lewat Prisma 7.
- **Web**: Next.js 16 (React 19) di folder [web/](web), dengan nuansa modern dan ornamen Jawa serta Jepang.
- **Auth**: login dengan JWT, OTP (bisa dimatikan sementara), request bertanda tangan, dan captcha.

## Fitur

- Katalog buku dengan pencarian dan jumlah stok.
- Peminjaman dengan jatuh tempo 14 hari. Peminjaman aman dari race condition, jadi stok tidak pernah negatif.
- Pengembalian dengan denda otomatis per hari penuh keterlambatan (default Rp1.000 per hari, atur lewat `LATE_FEE_PER_DAY`).
- Daftar keterlambatan dengan denda berjalan dan tombol **Hubungi via WhatsApp** (`wa.me`, dibuka manual oleh petugas, tidak mengirim pesan otomatis).
- Tema terang dan gelap, responsif di layar kecil.

## Keamanan

- Password di-hash dengan argon2id. Email disimpan terenkripsi (AES-256-GCM).
- JWT HS256 berlaku 15 menit. OTP 6 digit, kedaluwarsa 5 menit, maksimal 5 percobaan, sekali pakai.
- Endpoint `/auth/*` wajib request bertanda tangan HMAC-SHA256 (timestamp ±60 detik, nonce sekali pakai) dan captcha Cloudflare Turnstile.
- Aplikasi web memanggil backend lewat route server Next.js. `SIGNING_SECRET` dan JWT tidak pernah sampai ke kode browser. JWT disimpan di cookie `httpOnly`.

## Mulai cepat

Prasyarat: [Bun](https://bun.sh) 1.x, Node.js 20.9+, dan PostgreSQL 16 (bisa lewat Docker). Langkah lengkap ada di [docs/setup.md](docs/setup.md).

**Backend** (folder root):

```bash
bun install
cp .env.example .env          # isi JWT_SECRET, ENCRYPTION_KEY, SIGNING_SECRET, TURNSTILE_SECRET_KEY, DATABASE_URL
bunx prisma generate
bunx prisma migrate deploy
bun run start:dev             # http://localhost:3000
```

**Web** (jalankan di port lain agar tidak bentrok dengan backend):

```bash
cd web
bun install
cp .env.example .env.local    # isi BACKEND_URL dan SIGNING_SECRET (sama dengan backend)
bun run dev -- -p 3001        # http://localhost:3001
```

Daftar akun di `/daftar`, lalu masuk di `/masuk`. Dengan `OTP_ENABLED=false` di `.env` backend, login langsung berhasil tanpa OTP.

Cek backend hidup:

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

## Script

| Lokasi | Perintah | Fungsi |
|---|---|---|
| root | `bun run start:dev` | Backend dengan reload otomatis |
| root | `bun run start` | Backend tanpa reload |
| root | `bun run build` | Bundle backend ke `dist/` |
| root | `bun run test` | Test backend (butuh PostgreSQL lewat `DATABASE_URL`) |
| `web/` | `bun run dev -- -p 3001` | Web mode development |
| `web/` | `bun run build` lalu `bun run start -- -p 3001` | Web mode produksi |
| `web/` | `bun run lint` | ESLint |

## Variabel lingkungan

| Variabel | Wajib | Keterangan |
|---|---|---|
| `PORT` | Tidak | Port backend, default `3000` |
| `JWT_SECRET` | Ya | Minimal 32 karakter |
| `ENCRYPTION_KEY` | Ya | Base64 dari 32 byte |
| `SIGNING_SECRET` | Ya | Rahasia tanda tangan request, sama dengan di `web/.env.local` |
| `TURNSTILE_SECRET_KEY` | Ya | Untuk dev: `1x0000000000000000000000000000000AA` |
| `DATABASE_URL` | Ya | URL PostgreSQL |
| `LATE_FEE_PER_DAY` | Tidak | Denda per hari (rupiah), default `1000` |
| `OTP_ENABLED` | Tidak | `false` = login tanpa OTP. Default `true` |

Jangan commit `.env` dan `web/.env.local`. Keduanya sudah di-ignore git. Penjelasan rinci ada di [docs/setup.md](docs/setup.md).

## Struktur repo

```
src/            Backend NestJS (auth, books, members, loans, prisma, config, common)
prisma/         Skema Prisma dan migrasi
web/            Aplikasi web Next.js
docs/           Dokumentasi (setup, API, perpustakaan)
.claude/agents/ Definisi agent tim (lihat bagian Alur kerja tim)
```

## Dokumentasi

- [docs/setup.md](docs/setup.md): menjalankan backend dan web dari nol, plus masalah umum.
- [docs/api.md](docs/api.md): semua endpoint beserta contoh request dan respons.
- [docs/library.md](docs/library.md): aturan peminjaman, denda, dan known limitation.

## Alur kerja tim

Pekerjaan dikoordinasikan lewat GitHub issue oleh beberapa agent di [.claude/agents](.claude/agents): `project-manager`, `database`, `backend-dev`, `web-dev`, `docs`, dan `qa`. Status issue diatur lewat label:

`status:ready` → `status:in-progress` → `status:qa` → `status:done`, atau `status:rework` jika QA menolak.

Judul issue diawali `[DB]`, `[BACKEND]`, `[WEB]`, atau `[DOCS]` sesuai peran. Setiap komentar diawali nama peran, misalnya `[QA]`.

## Known limitation

- Akun login disimpan di memori backend dan hilang saat restart. Akun belum terhubung ke tabel anggota.
- Belum ada `GET /members`, jadi form pinjam di web memakai ID anggota manual. Web juga belum punya tombol pengembalian dan halaman tambah anggota.
- Captcha di development memakai token dummy. Pengiriman OTP hanya dicetak ke console. Keduanya perlu diganti sebelum produksi.
- Pesan error dari backend masih dalam bahasa Inggris.

Daftar lengkap ada di [docs/library.md](docs/library.md#known-limitation).
