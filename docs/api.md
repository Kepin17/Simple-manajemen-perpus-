# API

Daftar endpoint di `main` (commit `7b67b20`). Semua contoh sudah dijalankan terhadap server lokal pada 2026-10-22 dan responsnya dicocokkan. Contoh dengan nilai `id`, `token`, atau waktu bersifat dinamis, jadi nilainya akan berbeda di setiap run.

Asumsi: server berjalan di `http://localhost:3000` (atau sesuai `PORT`).

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
| POST | `/loans` | JWT | Pinjam buku |
| POST | `/loans/:id/return` | JWT | Kembalikan buku |
| GET | `/loans?memberId=` | JWT | Daftar pinjaman satu anggota |

## Format umum

- Body request berformat JSON dengan header `Content-Type: application/json`.
- Field yang tidak ada di DTO ditolak dengan `400` (`property ... should not exist`).
- Error memakai format Nest: `{"message": ..., "error": ..., "statusCode": ...}`.
- Tanggal ditulis dalam ISO 8601 UTC.

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

Fungsi shell berikut dipakai di semua contoh auth di bawah. Jalankan dari folder repo agar `.env` terbaca. Fungsi ini sudah diuji.

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
{"id":"bfd5afbb-ac26-4172-b34c-4dbe9f5673c9"}
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
{"challengeId":"VlzlrqtH237pfRqJ3zm6EQ"}
```

Lihat OTP di console server, misalnya `OTP for budi@example.com: 482913`.

Error: `401` `{"message":"Invalid credentials",...}` jika email atau password salah. Pesan ini tidak membedakan kedua kasus.

### POST /auth/otp/verify

Body: `challengeId` (string, maksimal 64 karakter) dan `code` (tepat 6 digit). OTP berlaku 5 menit, maksimal 5 percobaan, dan hanya bisa dipakai sekali.

```bash
OTP_BODY="{\"challengeId\":\"$CH\",\"code\":\"$CODE\"}"
sign POST /auth/otp/verify "$OTP_BODY"
curl -s -X POST http://localhost:3000/auth/otp/verify \
  -H 'Content-Type: application/json' "${SIGH[@]}" -d "$OTP_BODY"
```

Respons `200`:

```json
{"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiZmQ1...","tokenType":"Bearer","expiresIn":900}
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
{"id":"bfd5afbb-ac26-4172-b34c-4dbe9f5673c9","email":"budi@example.com","createdAt":"2026-10-22T07:48:25.421Z"}
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
[{"id":30,"title":"Bumi","author":"Tere Liye","isbn":"B-1792655325","totalCopies":1,"availableCopies":1,"createdAt":"2026-10-22T07:48:46.974Z","updatedAt":"2026-10-22T07:48:47.166Z"}]
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
  -d '{"title":"Laskar Pelangi","author":"Andrea Hirata","isbn":"978-1792655316","totalCopies":2}'
```

Respons `201`:

```json
{"id":26,"title":"Laskar Pelangi","author":"Andrea Hirata","isbn":"978-1792655316","totalCopies":2,"availableCopies":2,"createdAt":"2026-10-22T07:48:37.595Z","updatedAt":"2026-10-22T07:48:37.595Z"}
HTTP 201
```

Error:

- `409` `{"message":"ISBN already exists","error":"Conflict","statusCode":409}` jika ISBN sudah ada.
- `400` `{"message":["totalCopies must not be less than 1"],"error":"Bad Request","statusCode":400}` jika `totalCopies` di luar rentang.
- `400` `{"message":["property foo should not exist"],"error":"Bad Request","statusCode":400}` jika ada field yang tidak dikenal.

### GET /books/:id

```bash
curl -s -w '\nHTTP %{http_code}\n' http://localhost:3000/books/27 \
  -H "Authorization: Bearer $TOKEN"
```

```json
{"id":27,"title":"Bumi","author":"Tere Liye","isbn":"B-1792655316","totalCopies":1,"availableCopies":1,"createdAt":"2026-10-22T07:48:37.617Z","updatedAt":"2026-10-22T07:48:37.617Z"}
HTTP 200
```

Error:

- `404` `{"message":"Book not found","error":"Not Found","statusCode":404}`
- `400` `{"message":"Validation failed (numeric string is expected)","error":"Bad Request","statusCode":400}` jika `:id` bukan angka, misalnya `/books/abc`.

### POST /loans

Meminjam satu eksemplar buku untuk satu anggota. Respons `201`. `dueAt` = `borrowedAt` + 14 hari.

Body:

| Field | Tipe | Aturan |
|---|---|---|
| `bookId` | integer | Minimal 1 |
| `memberId` | integer | Minimal 1 |

```bash
curl -s -w '\nHTTP %{http_code}\n' -X POST http://localhost:3000/loans \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"bookId":27,"memberId":29}'
```

```json
{"id":19,"bookId":27,"memberId":29,"borrowedAt":"2026-10-22T07:48:37.703Z","dueAt":"2026-11-05T07:48:37.703Z","returnedAt":null,"createdAt":"2026-10-22T07:48:37.704Z","updatedAt":"2026-10-22T07:48:37.704Z"}
HTTP 201
```

Error:

- `404` `{"message":"Member not found","error":"Not Found","statusCode":404}` jika `memberId` tidak ada.
- `404` `{"message":"Book not found","error":"Not Found","statusCode":404}` jika `bookId` tidak ada.
- `409` `{"message":"No copies available","error":"Conflict","statusCode":409}` jika stok 0.
- `400` `{"message":["bookId must not be less than 1","bookId must be an integer number"],"error":"Bad Request","statusCode":400}` jika `bookId` bukan integer. Contohnya string `"27"`.

### POST /loans/:id/return

Mengembalikan pinjaman. Respons `200`. Stok buku bertambah 1.

```bash
curl -s -w '\nHTTP %{http_code}\n' -X POST http://localhost:3000/loans/20/return \
  -H "Authorization: Bearer $TOKEN"
```

```json
{"id":20,"bookId":30,"memberId":30,"borrowedAt":"2026-10-22T07:48:47.069Z","dueAt":"2026-11-05T07:48:47.069Z","returnedAt":"2026-10-22T07:48:47.163Z","createdAt":"2026-10-22T07:48:47.071Z","updatedAt":"2026-10-22T07:48:47.164Z"}
HTTP 200
```

Error:

- `409` `{"message":"Loan already returned","error":"Conflict","statusCode":409}` jika sudah pernah dikembalikan.
- `404` `{"message":"Loan not found","error":"Not Found","statusCode":404}` jika `:id` tidak ada.
- `400` jika `:id` bukan angka.

### GET /loans?memberId=

Daftar pinjaman satu anggota, diurutkan dari `borrowedAt` terbaru. Query `memberId` wajib dan harus angka.

```bash
curl -s -w '\nHTTP %{http_code}\n' "http://localhost:3000/loans?memberId=29" \
  -H "Authorization: Bearer $TOKEN"
```

```json
[{"id":19,"bookId":27,"memberId":29,"borrowedAt":"2026-10-22T07:48:37.703Z","dueAt":"2026-11-05T07:48:37.703Z","returnedAt":null,"createdAt":"2026-10-22T07:48:37.704Z","updatedAt":"2026-10-22T07:48:37.704Z"}]
HTTP 200
```

- Anggota yang tidak punya pinjaman, atau `memberId` yang tidak ada, membalas `200` dengan `[]`.
- `400` `{"message":"Validation failed (numeric string is expected)","error":"Bad Request","statusCode":400}` jika `memberId` hilang atau bukan angka.

## Known limitation

- Belum ada endpoint pembuatan anggota. Lihat [library.md](library.md#known-limitation).
- `POST /loans` membalas `404` jika buku atau anggota tidak ada, bukan `400`.
- `GET /books` tidak punya pagination.
- Tidak ada endpoint untuk mengubah atau menghapus buku.
- Tidak ada endpoint untuk melihat semua pinjaman. `GET /loans` wajib memakai `memberId`.
