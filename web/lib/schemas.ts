import { z } from "zod";

const email = z.string().trim().max(254, "Email maksimal 254 karakter").pipe(z.email("Format email tidak valid"));
const password = z.string().min(12, "Password minimal 12 karakter").max(128, "Password maksimal 128 karakter");

export const registerSchema = z.object({ email, password });
export const loginSchema = z.object({ email, password });
export const otpSchema = z.object({
  challengeId: z.string().min(1, "Challenge tidak valid").max(64),
  code: z.string().regex(/^\d{6}$/, "Kode OTP harus 6 digit"),
});
export const borrowSchema = z.object({
  bookId: z.coerce.number("ID buku tidak valid").int("ID buku tidak valid").min(1, "ID buku tidak valid"),
  memberId: z.coerce.number("ID anggota tidak valid").int("ID anggota tidak valid").min(1, "ID anggota tidak valid"),
});
export const idSchema = z.coerce.number("ID tidak valid").int("ID tidak valid").min(1, "ID tidak valid");
