# Perpustakaan

Dokumen ini menjelaskan fitur perpustakaan yang ada di `main` (commit `7b67b20`): katalog buku, anggota, peminjaman, dan pengembalian. Endpoint lengkap ada di [api.md](api.md).

## Fitur

- **Katalog buku**: tambah buku baru dan lihat daftar atau detail buku, termasuk jumlah stok.
- **Peminjaman**: anggota meminjam satu eksemplar buku. Sistem mengurangi stok dan membuat catatan pinjaman dengan tanggal jatuh tempo.
- **Pengembalian**: pinjaman ditandai kembali dan stok buku ditambah lagi.
- **Riwayat pinjaman per anggota**: daftar pinjaman milik satu anggota, dari yang terbaru.

Semua endpoint perpustakaan memakai **JWT** (`Authorization: Bearer <token>`). Endpoint ini tidak memakai tanda tangan request. Cara mendapatkan token ada di [api.md](api.md#autentikasi).

## Model data

Skema ada di `prisma/schema.prisma`, migrasi awal di `prisma/migrations/20261022073458_init_library`.

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
| `name` | String | Nama anggota |
| `email` | String | Unik |
| `createdAt`, `updatedAt` | DateTime | Diisi otomatis |

Tidak ada endpoint untuk membuat anggota. Lihat [known limitation](#known-limitation).

### Loan

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | Int | Primary key, auto increment |
| `bookId` | Int | Relasi ke `Book.id` |
| `memberId` | Int | Relasi ke `Member.id` |
| `borrowedAt` | DateTime | Waktu pinjam |
| `dueAt` | DateTime | Jatuh tempo, yaitu `borrowedAt` + 14 hari |
| `returnedAt` | DateTime, nullable | `null` selama buku belum dikembalikan |
| `createdAt`, `updatedAt` | DateTime | Diisi otomatis |

Relasi `Loan` ke `Book` dan `Member` memakai `ON DELETE RESTRICT`, jadi buku atau anggota yang masih punya pinjaman tidak bisa dihapus.

## Aturan peminjaman

1. **Anggota dan buku harus ada.** Jika anggota tidak ditemukan, sistem membalas `404 Member not found`. Jika buku tidak ditemukan, sistem membalas `404 Book not found`.
2. **Stok harus lebih dari 0.** Jika `availableCopies` = 0, sistem membalas `409 No copies available`.
3. **Stok dikurangi di transaksi yang sama dengan pembuatan pinjaman.** Pengurangan stok memakai kondisi `availableCopies > 0` di dalam database, jadi dua peminjaman bersamaan tidak bisa sama-sama mengambil eksemplar terakhir.
4. **Jatuh tempo 14 hari.** `dueAt` = `borrowedAt` + 14 hari (konstanta `LOAN_DAYS` di `src/loans/loans.service.ts`).
5. **Satu anggota boleh punya lebih dari satu pinjaman aktif untuk buku yang sama.** Tidak ada unique constraint `(bookId, memberId)`, dan kode tidak membatasi jumlah pinjaman aktif per anggota.

## Aturan pengembalian

1. **Pengembalian hanya bisa dilakukan sekali.** Pengembalian kedua untuk pinjaman yang sama membalas `409 Loan already returned`.
2. **Stok bertambah tepat satu kali.** Sistem mengisi `returnedAt` hanya jika nilainya masih `null`, lalu menambah `availableCopies` di transaksi yang sama.
3. **Pinjaman tidak ditemukan** membalas `404 Loan not found`.
4. **Keterlambatan tidak dihitung.** Respons pengembalian tidak menyebut denda atau status terlambat. Client membandingkan `returnedAt` dengan `dueAt` sendiri jika perlu.

## Aturan stok buku

- `availableCopies` awal sama dengan `totalCopies` saat buku dibuat.
- `totalCopies` harus bilangan bulat antara 1 dan 1.000.000.
- `availableCopies` tidak boleh negatif. Ini dijaga oleh constraint `Book_availableCopies_check` di database, dan oleh kondisi `availableCopies > 0` saat pinjam.
- ISBN harus unik. ISBN yang sudah ada membalas `409 ISBN already exists`.
- Tidak ada endpoint untuk mengubah `totalCopies`, mengubah data buku, atau menghapus buku.

## Known limitation

- **Belum ada endpoint pembuatan anggota.** Data `Member` harus dimasukkan langsung ke database. Dokumen ini tidak menjelaskan cara itu. Tanpa anggota, `POST /loans` selalu membalas `404 Member not found`.
- **`POST /loans` membalas 404 jika buku atau anggota tidak ada.** Ini sesuai kode saat ini, bukan `400` atau `422`. Client harus membedakan pesan `Book not found` dan `Member not found`.
- **Tidak ada pagination.** `GET /books` mengembalikan semua buku, diurutkan berdasarkan `id`.
- **`GET /loans` hanya bisa dipanggil dengan `memberId`.** Tidak ada endpoint untuk melihat semua pinjaman.
- **Tidak ada denda, status terlambat, atau pembatasan pinjaman.** Pinjaman yang lewat `dueAt` tetap bisa dikembalikan tanpa konsekuensi.
- **Satu anggota bisa meminjam buku yang sama berkali-kali** selama stok masih ada.
- **Pengguna login belum terhubung ke `Member`.** Akun dari alur auth disimpan di memori proses (`src/auth/user.repository.ts`), sedangkan anggota ada di tabel `Member`. Keduanya belum saling terkait, dan data akun hilang saat server di-restart.
- **OTP dicetak ke console.** Pengiriman OTP di `src/auth/console-otp.sender.ts` hanya untuk development dan melempar error jika `NODE_ENV=production`.
