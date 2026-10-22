-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "lateFee" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Member_phone_key" ON "Member"("phone");

-- CHECK constraint (manual; Prisma tidak punya schema-level CHECK)
-- phone: NULL atau digit saja (format internasional tanpa '+')
ALTER TABLE "Member" ADD CONSTRAINT "Member_phone_check" CHECK ("phone" IS NULL OR "phone" ~ '^[0-9]+$');
-- lateFee: rupiah tidak boleh negatif
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_lateFee_check" CHECK ("lateFee" >= 0);
