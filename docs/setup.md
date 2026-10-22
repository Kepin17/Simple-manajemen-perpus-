# Setup

Dokumen ini menjelaskan cara menjalankan backend (root) dan aplikasi web (`web/`) dari awal. Keduanya harus berjalan bersamaan, karena aplikasi web memanggil backend lewat route handler `web/app/api/*`.

Contoh di dokumen ini memakai backend di port **3000** (default `PORT`) dan aplikasi web di port **3001**.

## Prasyarat

| Alat | Versi | Keterangan |
|---|---|---|
| Bun | 1.x. Dipakai saat verifikasi: 1.3.14 | Menjalankan backend dan web. Versi di `web/package.json`: `bun@1.3.14` |
| Node.js | 20.9.0 atau lebih baru | Syarat Next.js 16 di `web/` |
| PostgreSQL | 16. Dipakai saat verifikasi: image `postgres:16-alpine` | Database `Book`, `Member`, dan `Loan` |
| Docker | Opsional | Dipakai untuk menjalankan PostgreSQL di container |
| OpenSSL | Apa pun | Membuat secret untuk `.env` |

## 1. Backend (root)

### 1.1 Instalasi

Jalankan dari folder root repo:

```bash
bun install
cp .env.example .env
```

### 1.2 Isi `.env`

Buka `.env` dan isi setiap variabel di bawah. Jangan commit `.env`. File ini sudah di-ignore oleh `.gitignore`.

| Variabel | Wajib | Keterangan |
|---|---|---|
| `PORT` | Tidak | Port backend. Default `3000` |
| `JWT_SECRET` | Ya | Minimal 32 karakter. Buat dengan `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Ya | Base64 dari 32 byte. Buat dengan `openssl rand -base64 32` |
| `SIGNING_SECRET` | Ya | Rahasia tanda tangan request. Buat dengan `openssl rand -hex 32`. Harus sama dengan `SIGNING_SECRET` di `web/.env.local` |
| `TURNSTILE_SECRET_KEY` | Ya | Untuk development, pakai secret test Cloudflare `1x0000000000000000000000000000000AA` (selalu lolos). Server perlu akses internet ke `challenges.cloudflare.com` |
| `DATABASE_URL` | Ya | URL PostgreSQL, format `postgresql://USER:PASSWORD@localhost:5432/NAMA_DATABASE` |
| `LATE_FEE_PER_DAY` | Tidak | Denda per hari dalam rupiah. Kosong atau tidak ada = `1000`. Harus bilangan bulat tidak negatif. Aturan denda ada di [library.md](library.md#denda-keterlambatan) |

Contoh membuat nilai secret. Tempel hasilnya ke `.env`, jangan ke chat atau commit:

```bash
openssl rand -hex 32     # JWT_SECRET atau SIGNING_SECRET
openssl rand -base64 32  # ENCRYPTION_KEY
```

Server gagal start jika `JWT_SECRET` kurang dari 32 karakter, `ENCRYPTION_KEY` bukan base64 dari 32 byte, atau salah satu variabel wajib kosong.

### 1.3 PostgreSQL

Pastikan PostgreSQL berjalan dan `DATABASE_URL` mengarah ke sana. Repo ini belum punya file Docker Compose. Saat verifikasi, PostgreSQL berjalan di container `postgres:16-alpine` dengan port `5432` terpetakan ke `127.0.0.1`.

Terapkan migrasi dan buat Prisma client:

```bash
bunx prisma generate        # membuat client di src/generated/prisma (folder ini tidak di-commit)
bunx prisma migrate deploy  # menerapkan migrasi di prisma/migrations
```

`prisma.config.ts` membaca `DATABASE_URL` dari `.env`.

### 1.4 Menjalankan backend

```bash
bun run start:dev   # development, reload otomatis
bun run start       # tanpa reload
```

Cek server hidup:

```bash
curl -s http://localhost:3000/health
```

```json
{"status":"ok"}
```

Log OTP muncul di terminal ini. Saat login, cari baris `OTP for <email>: <kode>`.

### 1.5 Test

```bash
bun run test
```

Tes `loans.service.spec.ts` terhubung ke PostgreSQL lewat `DATABASE_URL`, membuat data uji, lalu menghapusnya.

## 2. Aplikasi web (`web/`)

### 2.1 Instalasi

Dari folder root repo:

```bash
cd web
bun install
cp .env.example .env.local
```

### 2.2 Isi `web/.env.local`

| Variabel | Wajib | Keterangan |
|---|---|---|
| `BACKEND_URL` | Ya | Alamat backend, misalnya `http://localhost:3000`. Hanya dipakai di server, tidak pernah dikirim ke browser |
| `SIGNING_SECRET` | Ya | Harus sama persis dengan `SIGNING_SECRET` di `.env` root. Jika beda, login gagal dengan `401` |
| `CAPTCHA_TOKEN` | Tidak | Kosongkan untuk development. Kosong = token dummy `XXXX.DUMMY.TOKEN.XXXX` |

Isi `SIGNING_SECRET` dengan nilai yang sama dari `.env` root. Jangan commit `web/.env.local`. File ini sudah di-ignore oleh `web/.gitignore`.

### 2.3 Menjalankan web

Next.js memakai port 3000 secara default, sama dengan backend. Karena itu jalankan dengan `-p`:

```bash
bun run dev -- -p 3001
```

Buka `http://localhost:3001`. Halaman yang belum login akan diarahkan ke `/masuk`.

Script lain:

```bash
bun run build   # build produksi
bun run start   # menjalankan hasil build (setelah bun run build)
bun run lint    # ESLint
```

Next.js membaca `web/.env.local` saat start. Setelah mengubah file ini, restart `bun run dev`.

### 2.4 Alur pertama kali dari nol

Pastikan backend sudah berjalan di port 3000 (bagian 1.4), lalu:

1. Buka `http://localhost:3001/daftar` dan buat akun. Password minimal 12 karakter.
2. Buka `http://localhost:3001/masuk`, masukkan email dan password. Login hanya memeriksa email dan password, lalu mengirim OTP.
3. Ambil kode OTP dari terminal backend, baris `OTP for <email>: <kode>`, lalu masukkan di halaman masuk. Cookie `perpus_token` (httpOnly) diset dan Anda masuk.
4. Tambah buku dengan `POST /books` di [api.md](api.md#post-books).
5. Tambah anggota dengan `POST /members` di [api.md](api.md#post-members). Aplikasi web belum punya halaman untuk ini. Catat `id` dari respons.
6. Pinjam buku di `/pinjam/[id]`. Form memakai ID anggota secara manual, sesuai [known limitation](library.md#known-limitation).
7. Buka `/keterlambatan` untuk melihat daftar pinjaman terlambat.

Endpoint `POST /books` dan `POST /members` memakai JWT. Token web tersimpan di cookie httpOnly, jadi tidak bisa dibaca dari browser. Untuk memanggil API langsung, ambil `accessToken` lewat alur di [api.md](api.md#autentikasi).

## Masalah umum

| Gejala | Penyebab | Cara mengatasi |
|---|---|---|
| Login di web membalas `401` | `SIGNING_SECRET` di `web/.env.local` berbeda dengan root `.env` | Samakan nilainya, lalu restart `bun run dev` |
| Web membalas `500` dengan `Konfigurasi server web belum lengkap` | `BACKEND_URL` atau `SIGNING_SECRET` di `web/.env.local` kosong | Isi variabelnya, lalu restart `bun run dev` |
| Web membalas `502` dengan `Backend tidak dapat dihubungi` | Backend belum jalan, atau `BACKEND_URL` salah port | Jalankan backend, dan cek `BACKEND_URL` |
| `Captcha verification failed` | `TURNSTILE_SECRET_KEY` bukan secret test, atau server tidak bisa mengakses Cloudflare | Pakai secret test untuk dev, dan cek koneksi internet |
| Backend gagal start dengan `Missing env: ...` | Variabel wajib di `.env` kosong | Lengkapi variabel di [bagian 1.2](#12-isi-env) |
| Backend gagal start dengan `LATE_FEE_PER_DAY must be a non-negative integer` | Nilai `LATE_FEE_PER_DAY` bukan bilangan bulat tidak negatif | Perbaiki nilainya, atau kosongkan untuk memakai default |
| Backend gagal start dengan error koneksi Prisma | PostgreSQL belum jalan, atau `DATABASE_URL` salah | Jalankan PostgreSQL, lalu cek `DATABASE_URL` |
| Error `EADDRINUSE` di port 3000 | Proses lain memakai port itu | Hentikan proses lain, atau ganti `PORT` backend dan `BACKEND_URL` |
