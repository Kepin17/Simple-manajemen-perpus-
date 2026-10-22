import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const LOAN_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class LoansService {
  constructor(private prisma: PrismaService) {}

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
      const loan = await tx.loan.findUnique({ where: { id: loanId }, select: { bookId: true } });
      if (!loan) throw new NotFoundException('Loan not found');

      // Only one request can flip returnedAt from NULL, so the stock is restored exactly once.
      const { count } = await tx.loan.updateMany({
        where: { id: loanId, returnedAt: null },
        data: { returnedAt: new Date() },
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
}
