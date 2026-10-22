import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

const LOAN_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

// Denda = jumlah hari penuh setelah dueAt dikali tarif. Terlambat kurang dari 1 hari penuh = 0.
export function calcLateFee(dueAt: Date, returnedAt: Date, ratePerDay: number): number {
  const lateDays = Math.max(0, Math.floor((returnedAt.getTime() - dueAt.getTime()) / DAY_MS));
  return lateDays * ratePerDay;
}

@Injectable()
export class LoansService {
  constructor(
    private prisma: PrismaService,
    @Inject(ENV) private env: Env,
  ) {}

  borrow(bookId: number, memberId: number) {
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.member.findUnique({ where: { id: memberId }, select: { id: true } });
      if (!member) throw new NotFoundException('Member not found');

      // Conditional decrement: the WHERE is re-checked under the row lock, so two concurrent
      // borrows can't both take the last copy.
      const { count } = await tx.book.updateMany({
        where: { id: bookId, availableCopies: { gt: 0 } },
        data: { availableCopies: { decrement: 1 } },
      });
      if (count === 0) {
        const exists = await tx.book.findUnique({ where: { id: bookId }, select: { id: true } });
        if (!exists) throw new NotFoundException('Book not found');
        throw new ConflictException('No copies available');
      }

      const borrowedAt = new Date();
      return tx.loan.create({
        data: {
          bookId,
          memberId,
          borrowedAt,
          dueAt: new Date(borrowedAt.getTime() + LOAN_DAYS * DAY_MS),
        },
      });
    });
  }

  giveBack(loanId: number) {
    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({ where: { id: loanId }, select: { bookId: true, dueAt: true } });
      if (!loan) throw new NotFoundException('Loan not found');

      const returnedAt = new Date();
      const lateFee = calcLateFee(loan.dueAt, returnedAt, this.env.lateFeePerDay);

      // Only one request can flip returnedAt from NULL, so the stock is restored exactly once.
      const { count } = await tx.loan.updateMany({
        where: { id: loanId, returnedAt: null },
        data: { returnedAt, lateFee },
      });
      if (count === 0) throw new ConflictException('Loan already returned');

      await tx.book.update({
        where: { id: loan.bookId },
        data: { availableCopies: { increment: 1 } },
      });
      return tx.loan.findUniqueOrThrow({ where: { id: loanId } });
    });
  }

  listByMember(memberId: number) {
    return this.prisma.loan.findMany({
      where: { memberId },
      orderBy: { borrowedAt: 'desc' },
    });
  }

  // Belum dikembalikan dan sudah lewat dueAt. lateFee dihitung sampai saat permintaan.
  async listOverdue(now = new Date()) {
    const loans = await this.prisma.loan.findMany({
      where: { returnedAt: null, dueAt: { lt: now } },
      include: { member: { select: { name: true, phone: true } }, book: { select: { title: true } } },
      orderBy: { dueAt: 'asc' },
    });
    return loans.map((loan) => ({
      id: loan.id,
      memberName: loan.member.name,
      memberWhatsapp: loan.member.phone,
      bookTitle: loan.book.title,
      dueAt: loan.dueAt,
      lateFee: calcLateFee(loan.dueAt, now, this.env.lateFeePerDay),
    }));
  }
}
