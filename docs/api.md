# API

Daftar endpoint sesuai kode di `main` (commit `35bbca4`). Contoh request dan respons dijalankan terhadap server lokal pada 2026-10-22. Nilai `id`, `token`, dan waktu bersifat dinamis, jadi nilainya berbeda di setiap run. Struktur respons tetap sama.

Asumsi: server berjalan di `http://localhost:3000` (default `PORT`). Cara menjalankan ada di [setup.md](setup.md).

## Ringkasan

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/health` | Tidak | Cek server hidup |
| GET | `/version` | Tidak | Nama dan versi aplikasi |
| POST | `/auth/register` | Tanda tangan | Daftar akun |
| POST | `/auth/login` | Tanda tangan | Minta OTP |
| POST | `/auth/otp/verify` | Tanda tangan | Tukar OTP dengan JWT |
| GET | `/auth/me` | JWT | Data akun yang sedang login |
| GET | `/books` | JWT | Daftar semua buku |
| POST | `/books` | JWT | Tambah buku |
| GET | `/books/:id` | JWT | Detail satu buku |
| POST | `/members` | JWT | Tambah anggota |
| POST | `/loans` | JWT | Pinjam buku |
| POST | `/loans/:id/return` | JWT | Kembalikan buku dan catat denda |
| GET | `/loans?memberId=` | JWT | Daftar pinjaman satu anggota |
| GET | `/loans/overdue` | JWT | Daftar pinjaman terlambat beserta denda berjalan |

## Format umum

- Body request berformat JSON dengan header `Content-Type: application/json`.
- Field yang tidak ada di DTO ditolak dengan `400` (`property ... should not exist`).
- Error memakai format Nest: `{"message": ..., "error": ..., "statusCode": ...}`.
- Pesan error dari backend dalam bahasa Inggris.
- Tanggal ditulis dalam ISO 8601 UTC.
- Nilai denda (`lateFee`) dalam rupiah, berupa bilangan bulat.

## Health dan version

```bash
curl -s http://localhost:3000/health
```

```json
{"status":"ok"}
```

```bash
curl -s http://localhost:3000/version
```

```json
{"name":"nyoba-dari-video","version":"0.0.1"}
```

## Autentikasi

Alur login memakai OTP dua langkah, lalu JWT. Token berlaku 15 menit (`expiresIn: 900`).

1. `POST /auth/register` untuk membuat akun.
2. `POST /auth/login` dengan email dan password. Server mengirim OTP. Di development, OTP hanya dicetak ke console server dengan format `OTP for <email>: <kode>`.
3. `POST /auth/otp/verify` dengan `challengeId` dan kode OTP. Hasilnya `accessToken`.
4. Pakai `accessToken` sebagai `Authorization: Bearer <accessToken>` di endpoint perpustakaan.

### Tanda tangan request (hanya endpoint auth)

Tiga endpoint `POST /auth/*` wajib membawa header:

- `X-Timestamp`: waktu dalam milidetik Unix. Harus dalam rentang ±60 detik dari waktu server.
- `X-Nonce`: string acak, maksimal 128 karakter. Hanya bisa dipakai sekali.
- `X-Signature`: HMAC-SHA256 hex dari canonical string.

Canonical string, dipisah `\n`:

```
METHOD_UPPERCASE
path
timestamp
nonce
sha256_hex(rawBody)
```

Signature = `HMAC-SHA256(canonical, SIGNING_SECRET)` dalam hex. Implementasi ada di `src/common/signature.guard.ts`.

Fungsi shell berikut dipakai di semua contoh auth di bawah. Jalankan dari folder repo agar `.env` terbaca.

```bash
set -a; . ./.env; set +a

sign() { # $1 = METHOD, $2 = path, $3 = body JSON persis seperti yang dikirim
  local ts nonce bh canon sig
  ts=$(date +%s%3N)
  nonce=$(openssl rand -hex 16)
  bh=$(printf '%s' "$3" | sha256sum | cut -d' ' -f1)
  canon=$(printf '%s\n%s\n%s\n%s\n%s' "$1" "$2" "$ts" "$nonce" "$bh")
  sig=$(printf '%s' "$canon" | openssl dgst -sha256 -hmac "$SIGNING_SECRET" | awk '{print $NF}')
  SIGH=(-H "X-Timestamp: $ts" -H "X-Nonce: $nonce" -H "X-Signature: $sig")
}
```

Body yang ditandatangani harus sama byte per byte dengan body yang dikirim. Karena itu simpan body di variabel dan pakai variabel yang sama untuk `sign` dan `-d`.

### POST /auth/register

Membuat akun baru. Login dan register memakai captcha Cloudflare Turnstile. Di development, token dummy `XXXX.DUMMY.TOKEN.XXXX` diterima karena secret test di `.env.example` selalu lolos. Server perlu akses internet ke `challenges.cloudflare.com`.

Body:

| Field | Tipe | Aturan |
|---|---|---|
| `email` | string | Format email, maksimal 254 karakter |
| `password` | string | 12 sampai 128 karakter |
| `captchaToken` | string | Tidak kosong |

Contoh:

```bash
REG='{"email":"budi@example.com","password":"correct-horse-battery","captchaToken":"XXXX.DUMMY.TOKEN.XXXX"}'
sign POST /auth/register "$REG"
curl -s -w '\nHTTP %{http_code}\n' -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' "${SIGH[@]}" -d "$REG"
```

Respons `201`:

```json
{"id":"d6e4f135-012b-4c8e-929d-332884be9a96"}
HTTP 201
```

Error:

- `409` `{"message":"Email already registered","error":"Conflict","statusCode":409}`
- `401` jika header tanda tangan hilang atau salah.

### POST /auth/login

Memeriksa email dan password, lalu mengirim OTP. Body sama dengan register. Respons `200`.

```bash
LOGIN='{"email":"budi@example.com","password":"correct-horse-battery","captchaToken":"XXXX.DUMMY.TOKEN.XXXX"}'
sign POST /auth/login "$LOGIN"
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' "${SIGH[@]}" -d "$LOGIN"
```

```json
{"challengeId":"ZOTXHsfnEoehcT2Q_L4tNw"}
```

Lihat OTP di console server, misalnya `OTP for budi@example.com: 482913`.

Error: `401` `{"message":"Invalid credentials",...}` jika email atau password salah. Pesan ini tidak membedakan kedua kasus.

### POST /auth/otp/verify

Body: `challengeId` (string, maksimal 64 karakter) dan `code` (tepat 6 digit). OTP berlaku 5 menit, maksimal 5 percobaan, dan hanya bisa dipakai sekali. Contoh di bawah mengasumsikan `CH` berisi `challengeId` dan `CODE` berisi kode dari console.

```bash
OTP_BODY="{\"challengeId\":\"$CH\",\"code\":\"$CODE\"}"
sign POST /auth/otp/verify "$OTP_BODY"
curl -s -X POST http://localhost:3000/auth/otp/verify \
  -H 'Content-Type: application/json' "${SIGH[@]}" -d "$OTP_BODY"
```

Respons `200`:

```json
{"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNmU0ZjEzNS0wMTJiLTRjOGUtOTI5ZC0zMzI4ODRiZTlhOTYiLCJpYXQiOjE3OTI2NTc5NTAsImV4cCI6MTc5MjY1ODg1MH0.ykP_WBR2MQ9H56PQIvg8f2zBSxAO8CpQEyqTIU6L5A4","tokenType":"Bearer","expiresIn":900}
```

Error: `401` `{"message":"Invalid or expired code","error":"Unauthorized","statusCode":401}` jika kode salah, kedaluwarsa, atau percobaan habis.

Simpan token ke variabel. Contoh di bawah memakai ekstraksi dengan `sed`:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/otp/verify \
  -H 'Content-Type: application/json' "${SIGH[@]}" -d "$OTP_BODY" \
  | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
```

### GET /auth/me

Data akun dari JWT. Memakai JWT saja, tanpa tanda tangan.

```bash
curl -s -w '\nHTTP %{http_code}\n' http://localhost:3000/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

```json
{"id":"d6e4f135-012b-4c8e-929d-332884be9a96","email":"budi@example.com","createdAt":"2026-10-22T08:32:29.299Z"}
HTTP 200
```

Tanpa header `Authorization`:

```json
{"message":"Unauthorized","statusCode":401}
HTTP 401
```

## Endpoint perpustakaan

Semua endpoint di bagian ini memakai JWT saja: `Authorization: Bearer $TOKEN`. Tidak ada header tanda tangan.

### GET /books

Mengembalikan semua buku, diurutkan berdasarkan `id`. Tidak ada pagination.

```bash
curl -s -w '\nHTTP %{http_code}\n' http://localhost:3000/books \
  -H "Authorization: Bearer $TOKEN"
```

```json
[{"id":84,"title":"Bumi","author":"Tere Liye","isbn":"B-1792657950","totalCopies":1,"availableCopies":1,"createdAt":"2026-10-22T08:32:30.527Z","updatedAt":"2026-10-22T08:32:30.527Z"}]
HTTP 200
```

Respons asli berisi semua buku. Contoh di atas hanya satu item.

### POST /books

Menambah buku. `availableCopies` otomatis sama dengan `totalCopies`.

Body:

| Field | Tipe | Aturan |
|---|---|---|
| `title` | string | Tidak kosong, maksimal 200 karakter |
| `author` | string | Tidak kosong, maksimal 200 karakter |
| `isbn` | string | Tidak kosong, maksimal 32 karakter, harus unik |
| `totalCopies` | integer | 1 sampai 1.000.000 |

```bash
curl -s -w '\nHTTP %{http_code}\n' -X POST http://localhost:3000/books \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Laskar Pelangi","author":"Andrea Hirata","isbn":"978-1792658001","totalCopies":2}'
```

Respons `201`:

```json
{"id":86,"title":"Laskar Pelangi","author":"Andrea Hirata","isbn":"978-1792658001","totalCopies":2,"availableCopies":2,"createdAt":"2026-10-22T08:33:19.266Z","updatedAt":"2026-10-22T08:33:19.266Z"}
HTTP 201
```

Error:

- `409` `{"message":"ISBN already exists","error":"Conflict","statusCode":409}` jika ISBN sudah ada. Ganti ISBN jika contoh di atas sudah dipakai.
- `400` `{"message":["totalCopies must not be less than 1"],"error":"Bad Request","statusCode":400}` jika `totalCopies` di luar rentang.
- `400` `{"message":["property foo should not exist"],"error":"Bad Request","statusCode":400}` jika ada field yang tidak dikenal.

### GET /books/:id

```bash
curl -s -w '\nHTTP %{http_code}\n' http://localhost:3000/books/84 \
  -H "Authorization: Bearer $TOKEN"
```

```json
{"id":84,"title":"Bumi","author":"Tere Liye","isbn":"B-1792657950","totalCopies":1,"availableCopies":1,"createdAt":"2026-10-22T08:32:30.527Z","updatedAt":"2026-10-22T08:32:30.527Z"}
HTTP 200
```

Error:

- `404` `{"message":"Book not found","error":"Not Found","statusCode":404}`
- `400` `{"message":"Validation failed (numeric string is expected)","error":"Bad Request","statusCode":400}` jika `:id` bukan angka, misalnya `/books/abc`.

### POST /members

Menambah anggota. Respons `201`. Anggota baru dipakai sebagai `memberId` di `POST /loans`.

Body:

| Field | Tipe | Aturan |
|---|---|---|
| `name` | string | Tidak kosong, maksimal 200 karakter |
| `email` | string | Format email, maksimal 254 karakter, harus unik |
| `phone` | string, opsional | Hanya digit tanpa `+`, maksimal 15 digit, harus unik jika diisi |

```bash
curl -s -w '\nHTTP %{http_code}\n' -X POST http://localhost:3000/members \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Siti Rahayu","email":"siti.rahayu@example.com","phone":"628123456789"}'
```

Respons `201`:

```json
{"id":132,"name":"Siti Rahayu","email":"siti.rahayu@example.com","phone":"628123456789","createdAt":"2026-10-22T08:33:11.060Z","updatedAt":"2026-10-22T08:33:11.060Z"}
HTTP 201
```

Tanpa `phone`, field `phone` pada respons bernilai `null`.

Error:

- `409` `{"message":"Email or phone already registered","error":"Conflict","statusCode":409}` jika email atau phone sudah dipakai anggota lain. Pesan ini tidak menyebut field mana yang bentrok.
- `400` `{"message":["phone must be digits only, without +, max 15 digits"],"error":"Bad Request","statusCode":400}` jika `phone` berisi `+`, huruf, atau lebih dari 15 digit.
- `400` `{"message":["property foo should not exist"],"error":"Bad Request","statusCode":400}` jika ada field yang tidak dikenal.
- `401` `{"message":"Unauthorized","statusCode":401}` jika header `Authorization` hilang.

### POST /loans

Meminjam satu eksemplar buku untuk satu anggota. Respons `201`. `dueAt` = `borrowedAt` + 14 hari. Field `lateFee` selalu `0` saat pinjaman dibuat.

Body:

| Field | Tipe | Aturan |
|---|---|---|
| `bookId` | integer | Minimal 1 |
| `memberId` | integer | Minimal 1 |

```bash
curl -s -w '\nHTTP %{http_code}\n' -X POST http://localhost:3000/loans \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"bookId":86,"memberId":132}'
```

```json
{"id":81,"bookId":86,"memberId":132,"borrowedAt":"2026-10-22T08:33:19.278Z","dueAt":"2026-11-05T08:33:19.278Z","returnedAt":null,"lateFee":0,"createdAt":"2026-10-22T08:33:19.279Z","updatedAt":"2026-10-22T08:33:19.279Z"}
HTTP 201
```

Error:

- `404` `{"message":"Member not found","error":"Not Found","statusCode":404}` jika `memberId` tidak ada.
- `404` `{"message":"Book not found","error":"Not Found","statusCode":404}` jika `bookId` tidak ada.
- `409` `{"message":"No copies available","error":"Conflict","statusCode":409}` jika stok 0.
- `400` `{"message":["bookId must not be less than 1","bookId must be an integer number"],"error":"Bad Request","statusCode":400}` jika `bookId` bukan integer. Contohnya string `"27"`.

### POST /loans/:id/return

Mengembalikan pinjaman. Respons `200`. Stok buku bertambah 1. Denda keterlambatan dihitung dan disimpan di `lateFee`. Aturan denda ada di [library.md](library.md#denda-keterlambatan).

Perubahan dibanding versi sebelumnya: respons sekarang memuat `lateFee`. Pengembalian yang terlambat tetap diterima.

```bash
curl -s -w '\nHTTP %{http_code}\n' -X POST http://localhost:3000/loans/81/return \
  -H "Authorization: Bearer $TOKEN"
```

Contoh di atas dijalankan pada pinjaman yang `dueAt`-nya sudah lewat 3 hari 2 jam. `dueAt` itu diubah manual di database dev hanya untuk pengujian. Pada penggunaan normal, pinjaman jatuh tempo 14 hari setelah dipinjam.

```json
{"id":81,"bookId":86,"memberId":132,"borrowedAt":"2026-10-22T08:33:19.278Z","dueAt":"2026-10-19T06:33:19.000Z","returnedAt":"2026-10-22T08:33:19.375Z","lateFee":3000,"createdAt":"2026-10-22T08:33:19.279Z","updatedAt":"2026-10-22T08:33:19.375Z"}
HTTP 200
```

Error:

- `409` `{"message":"Loan already returned","error":"Conflict","statusCode":409}` jika sudah pernah dikembalikan.
- `404` `{"message":"Loan not found","error":"Not Found","statusCode":404}` jika `:id` tidak ada.
- `400` jika `:id` bukan angka.

### GET /loans?memberId=

Daftar pinjaman satu anggota, diurutkan dari `borrowedAt` terbaru. Query `memberId` wajib dan harus angka. Setiap item memuat `lateFee`.

```bash
curl -s -w '\nHTTP %{http_code}\n' "http://localhost:3000/loans?memberId=132" \
  -H "Authorization: Bearer $TOKEN"
```

```json
[{"id":81,"bookId":86,"memberId":132,"borrowedAt":"2026-10-22T08:33:19.278Z","dueAt":"2026-10-19T06:33:19.000Z","returnedAt":"2026-10-22T08:33:19.375Z","lateFee":3000,"createdAt":"2026-10-22T08:33:19.279Z","updatedAt":"2026-10-22T08:33:19.375Z"}]
HTTP 200
```

- Anggota yang tidak punya pinjaman, atau `memberId` yang tidak ada, membalas `200` dengan `[]`.
- `400` `{"message":"Validation failed (numeric string is expected)","error":"Bad Request","statusCode":400}` jika `memberId` hilang atau bukan angka.

### GET /loans/overdue

Daftar pinjaman yang belum dikembalikan dan sudah lewat `dueAt`, diurutkan dari `dueAt` paling lama. `lateFee` dihitung saat request, jadi nilainya naik setiap hari penuh. Nilai ini tidak disimpan ke database sampai pinjaman dikembalikan. Pinjaman yang sudah dikembalikan tidak muncul di sini.

Tidak ada pagination. Jika tidak ada pinjaman terlambat, respons berupa `[]`.

```bash
curl -s -w '\nHTTP %{http_code}\n' http://localhost:3000/loans/overdue \
  -H "Authorization: Bearer $TOKEN"
```

```json
[{"id":81,"memberName":"Siti Rahayu","memberWhatsapp":"628123456789","bookTitle":"Laskar Pelangi","dueAt":"2026-10-19T06:33:19.000Z","lateFee":3000},{"id":70,"memberName":"Anggota A","memberWhatsapp":"62811192656459","bookTitle":"Uji Denda QA 1792656459","dueAt":"2026-10-20T08:07:41.487Z","lateFee":2000}]
HTTP 200
```

Field:

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | integer | ID pinjaman. Dipakai untuk `POST /loans/:id/return` |
| `memberName` | string | Nama anggota |
| `memberWhatsapp` | string, nullable | `phone` anggota. `null` jika anggota tidak punya `phone` |
| `bookTitle` | string | Judul buku |
| `dueAt` | string | Jatuh tempo, ISO 8601 UTC |
| `lateFee` | integer | Denda berjalan dalam rupiah, dihitung saat request |

Respons di atas memuat dua pinjaman. Baris kedua berasal dari data uji sebelumnya dan bisa berbeda di database Anda.

## Known limitation

- **Belum ada `GET /members`.** Anggota dibuat lewat `POST /members`, tetapi tidak ada endpoint untuk melihat atau mencari anggota. Form pinjam di aplikasi web memakai ID anggota secara manual. Lihat [library.md](library.md#known-limitation).
- **`POST /loans` membalas `404` jika buku atau anggota tidak ada**, bukan `400`.
- **Pesan error dari backend dalam bahasa Inggris.** Aplikasi web meneruskan pesan ini apa adanya.
- **Captcha untuk development memakai token dummy** `XXXX.DUMMY.TOKEN.XXXX`.
- **Akun auth disimpan di memori.** Akun login dan OTP hilang saat server restart. Data buku, anggota, dan pinjaman tetap ada di PostgreSQL.
- **`GET /books` tidak punya pagination.**
- **Tidak ada endpoint untuk mengubah atau menghapus buku.**
- **Tidak ada endpoint untuk melihat semua pinjaman.** `GET /loans` wajib memakai `memberId`.
- **Tidak ada pencatatan pembayaran denda.**
