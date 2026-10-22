import { defineConfig, env } from "prisma/config";

// Prisma CLI tidak memuat .env sendiri. Node >= 20.12 punya loadEnvFile; variabel shell tetap menang.
try {
  process.loadEnvFile(".env");
} catch {
  // tidak ada .env: pakai env dari shell
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
