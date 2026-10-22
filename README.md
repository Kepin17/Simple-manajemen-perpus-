# nyoba-dari-video

Backend memakai **NestJS** yang dijalankan dengan **Bun**.

## Prasyarat

- [Bun](https://bun.sh) 1.x

## Setup

```bash
bun install
cp .env.example .env
```

## Menjalankan

```bash
bun run start:dev   # development, auto-reload
bun run start       # production-like
```

Server berjalan di `http://localhost:3000` (ubah lewat `PORT` di `.env`).

## Cek health

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

## Script lain

```bash
bun run build       # bundle ke dist/
bun run test        # jalankan test
```
