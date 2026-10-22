# Perpustakaan

Dokumen ini menjelaskan fitur perpustakaan sesuai kode di `main` (commit `334a9f7`): katalog buku, anggota, peminjaman, pengembalian, dan denda keterlambatan. Endpoint lengkap ada di [api.md](api.md). Cara menjalankan server dan aplikasi web ada di [setup.md](setup.md).

## Fitur

- **Katalog buku**: tambah buku baru dan lihat daftar atau detail buku, termasuk jumlah stok.
- **Anggota**: tambah anggota baru. Belum ada endpoint untuk melihat daftar anggota (lihat [known limitation](#known-limitation)).
- **Peminjaman**: anggota meminjam satu eksemplar buku. Sistem mengurangi stok dan membuat catatan pinjaman dengan tanggal jatuh tempo.
- **Pengembalian**: pinjaman ditandai kembali, stok buku ditambah lagi, dan denda keterlambatan dihitung.
- **Denda keterlambatan**: aturan denda ada di [bagian denda](#denda-keterlambatan). Daftar pinjaman yang terlambat tersedia di `GET /loans/overdue`.
- **Riwayat pinjaman per anggota**: daftar pinjaman milik satu anggota, dari yang terbaru.

Semua endpoint perpustakaan memakai **JWT** (`Authorization: Bearer <token>`). Endpoint ini tidak memakai tanda tangan request. Cara mendapatkan token ada di [api.md](api.md#autentikasi).

## Model data

Skema ada di `prisma/schema.prisma`. Migrasi ada di `prisma/migrations/`: `20261022073458_init_library` dan `20261022075819_member_phone_loan_late_fee`.

### Book

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | Int | Primary key, auto increment |
| `title` | String | Judul buku, maksimal 200 karakter saat dibuat |
| `author` | String | Nama penulis, maksimal 200 karakter saat dibuat |
| `isbn` | String | Unik. Maksimal 32 karakter saat dibuat |
| `totalCopies` | Int | Jumlah eksemplar yang dimiliki |
| `availableCopies` | Int | Jumlah eksemplar yang sedang bisa dipinjam. Tidak boleh di bawah 0 |
| `createdAt`, `updatedAt` | DateTime | Diisi otomatis |

### Member

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | Int | Primary key, auto increment |
| `name` | String | Nama anggota, tidak kosong, maksimal 200 karakter saat dibuat |
| `email` | String | Unik, maksimal 254 karakter |
| `phone` | String, nullable | Unik. Hanya digit tanpa `+`, maksimal 15 digit, contoh `628123456789`. Dijaga juga oleh constraint di database |
| `createdAt`, `updatedAt` | DateTime | Diisi otomatis |

Anggota dibuat lewat `POST /members`. Lihat [api.md](api.md#post-members).

### Loan

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | Int | Primary key, auto increment |
| `bookId` | Int | Relasi ke `Book.id` |
| `memberId` | Int | Relasi ke `Member.id` |
| `borrowedAt` | DateTime | Waktu pinjam |
| `dueAt` | DateTime | Jatuh tempo, yaitu `borrowedAt` + 14 hari |
| `returnedAt` | DateTime, nullable | `null` selama buku belum dikembalikan |
| `lateFee` | Int | Denda dalam rupiah, default `0`. Diisi saat pengembalian. Tidak pernah negatif (dijaga constraint di database) |
| `createdAt`, `updatedAt` | DateTime | Diisi otomatis |

Relasi `Loan` ke `Book` dan `Member` memakai `ON DELETE RESTRICT`, jadi buku atau anggota yang masih punya pinjaman tidak bisa dihapus.

## Aturan peminjaman

1. **Anggota dan buku harus ada.** Jika anggota tidak ditemukan, sistem membalas `404 Member not found`. Jika buku tidak ditemukan, sistem membalas `404 Book not found`.
2. **Stok harus lebih dari 0.** Jika `availableCopies` = 0, sistem membalas `409 No copies available`.
3. **Stok dikurangi di transaksi yang sama dengan pembuatan pinjaman.** Pengurangan stok memakai kondisi `availableCopies > 0` di dalam database, jadi dua peminjaman bersamaan tidak bisa sama-sama mengambil eksemplar terakhir.
4. **Jatuh tempo 14 hari.** `dueAt` = `borrowedAt` + 14 hari (konstanta `LOAN_DAYS` di `src/loans/loans.service.ts`).
5. **Satu anggota boleh punya lebih dari satu pinjaman aktif untuk buku yang sama.** Tidak ada unique constraint `(bookId, memberId)`, dan kode tidak membatasi jumlah pinjaman aktif per anggota.

## Denda keterlambatan

### Tarif

Tarif denda per hari dibaca dari `LATE_FEE_PER_DAY` (rupiah) di `.env`. Implementasi ada di `src/config/env.ts`.

- Jika variabel kosong atau tidak ada, tarifnya **1000** (`DEFAULT_LATE_FEE_PER_DAY`).
- Nilai harus bilangan bulat tidak negatif. `0` berarti tidak ada denda. Nilai seperti `abc`, `-1`, atau `2.5` membuat server gagal start dengan pesan `LATE_FEE_PER_DAY must be a non-negative integer`.
- Tarif dibaca sekali saat server start. Untuk mengganti tarif, ubah `.env` lalu restart server.

### Rumus

```
hari_terlambat = max(0, floor((waktu_kembali - dueAt) / 24 jam))
denda          = hari_terlambat * LATE_FEE_PER_DAY
```

Aturan:

1. **Hanya hari penuh yang dihitung.** Sisa jam dibuang. Terlambat 1 hari 23 jam dihitung 1 hari.
2. **Kurang dari 1 hari penuh terlambat = denda 0.**
3. **Dikembalikan pada `dueAt` atau lebih awal = denda 0.**
4. **Saat pengembalian, denda disimpan** di `Loan.lateFee` memakai waktu pengembalian server. Nilai ini tidak berubah walau tarif diganti kemudian.
5. **Selama belum dikembalikan, denda belum disimpan.** `GET /loans/overdue` menghitung `lateFee` dengan waktu request, jadi angkanya naik setiap hari penuh. Nilai ini hanya ada di respons.
6. **Tidak ada status pembayaran.** Sistem tidak mencatat apakah denda sudah dibayar atau dilunasi.

Contoh dengan tarif 1000 dan `dueAt` 5 November 2026 pukul 00:00 UTC:

| Waktu pengembalian | Lama terlambat | Hari penuh | Denda |
|---|---|---|---|
| 5 November 2026, 00:00 (tepat di `dueAt`) | 0 | 0 | 0 |
| 5 November 2026, 23:59 | 23 jam 59 menit | 0 | 0 |
| 6 November 2026, 00:00 | 1 hari | 1 | 1000 |
| 6 November 2026, 23:00 | 1 hari 23 jam | 1 | 1000 |
| 8 November 2026, 02:00 | 3 hari 2 jam | 3 | 3000 |

Aturan ini diuji di `src/loans/loans.service.spec.ts` (fungsi `calcLateFee` dan `giveBack`/`listOverdue` terhadap database).

## Aturan pengembalian

1. **Pengembalian hanya bisa dilakukan sekali.** Pengembalian kedua untuk pinjaman yang sama membalas `409 Loan already returned`.
2. **Stok bertambah tepat satu kali.** Sistem mengisi `returnedAt` hanya jika nilainya masih `null`, lalu menambah `availableCopies` di transaksi yang sama.
3. **Pinjaman tidak ditemukan** membalas `404 Loan not found`.
4. **Pengembalian yang terlambat tetap diterima.** Denda dihitung sesuai [aturan denda](#denda-keterlambatan), disimpan di `lateFee`, dan dikembalikan di respons `POST /loans/:id/return`.

## Daftar keterlambatan

`GET /loans/overdue` menampilkan pinjaman yang `returnedAt`-nya masih `null` dan `dueAt`-nya sudah lewat. Urutannya dari `dueAt` paling lama. Setiap baris berisi nama anggota, nomor WhatsApp anggota (`memberWhatsapp`, bisa `null`), judul buku, `dueAt`, dan `lateFee` yang dihitung saat request. Pinjaman yang sudah dikembalikan tidak muncul.

## Aturan stok buku

- `availableCopies` awal sama dengan `totalCopies` saat buku dibuat.
- `totalCopies` harus bilangan bulat antara 1 dan 1.000.000.
- `availableCopies` tidak boleh negatif. Ini dijaga oleh constraint `Book_availableCopies_check` di database, dan oleh kondisi `availableCopies > 0` saat pinjam.
- ISBN harus unik. ISBN yang sudah ada membalas `409 ISBN already exists`.
- Tidak ada endpoint untuk mengubah `totalCopies`, mengubah data buku, atau menghapus buku.

## Known limitation

- **Belum ada `GET /members`.** Anggota bisa dibuat dengan `POST /members`, tetapi tidak ada endpoint untuk melihat atau mencari anggota. Form pinjam di aplikasi web memakai **ID anggota secara manual**, jadi pengguna harus menyalin `id` dari respons `POST /members`.
- **Pesan error backend dalam bahasa Inggris**, misalnya `Member not found` dan `No copies available`. Aplikasi web meneruskan pesan ini apa adanya, jadi error dari backend tampil dalam bahasa Inggris. Pesan validasi di sisi route handler web memakai bahasa Indonesia.
- **Captcha dummy untuk development.** Token `XXXX.DUMMY.TOKEN.XXXX` diterima karena `TURNSTILE_SECRET_KEY` berisi secret test Cloudflare. Aplikasi web memakai token ini kecuali `CAPTCHA_TOKEN` diisi.
- **Akun auth disimpan di memori proses.** Akun login (`src/auth/user.repository.ts`) dan challenge OTP hilang saat server di-restart. Data `Book`, `Member`, dan `Loan` ada di PostgreSQL dan tetap ada. Akun login belum terhubung ke `Member`.
- **Database PostgreSQL berjalan di container** saat development. Image yang dipakai saat verifikasi: `postgres:16-alpine`, port `5432` di `127.0.0.1`. Repo ini belum punya file Docker Compose.
- **Aplikasi web belum punya tombol pengembalian.** Pengembalian hanya bisa lewat `POST /loans/:id/return`.
- **Aplikasi web belum punya halaman tambah anggota.** Anggota dibuat lewat `POST /members`.
- **Tidak ada pembayaran denda.** Tidak ada endpoint atau status untuk mencatat pelunasan denda.
- **Tidak ada pagination.** `GET /books` mengembalikan semua buku, diurutkan berdasarkan `id`.
- **`GET /loans` hanya bisa dipanggil dengan `memberId`.** Tidak ada endpoint untuk melihat semua pinjaman. Daftar terlambat ada di `GET /loans/overdue`.
- **`POST /loans` membalas 404 jika buku atau anggota tidak ada**, bukan `400` atau `422`. Client harus membedakan pesan `Book not found` dan `Member not found`.
- **Satu anggota bisa meminjam buku yang sama berkali-kali** selama stok masih ada, dan tidak ada batas jumlah pinjaman aktif per anggota.
- **OTP dicetak ke console.** Pengiriman OTP di `src/auth/console-otp.sender.ts` hanya untuk development dan melempar error jika `NODE_ENV=production`.
- **OTP bisa dimatikan sementara.** Dengan `OTP_ENABLED=false` di `.env` backend, login langsung memberi JWT. Ini melemahkan keamanan login, jadi nyalakan lagi (hapus atau set `true`) dan ganti pengiriman OTP dengan email atau SMS sebelum produksi.
