import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { LoansService } from './loans.service';

// Tes integrasi ke PostgreSQL (DATABASE_URL). Data dibuat per-run dan dihapus di afterAll.
const prisma = new PrismaService({ databaseUrl: process.env.DATABASE_URL! } as Env);
const loans = new LoansService(prisma);

const created = { bookIds: [] as number[], memberIds: [] as number[] };

async function makeBook(availableCopies: number) {
  const book = await prisma.book.create({
    data: { title: 'Test', author: 'Test', isbn: `TEST-${randomUUID()}`, totalCopies: availableCopies, availableCopies },
  });
  created.bookIds.push(book.id);
  return book;
}

async function makeMember() {
  const member = await prisma.member.create({
    data: { name: 'Test', email: `test-${randomUUID()}@example.com` },
  });
  created.memberIds.push(member.id);
  return member;
}

const stockOf = async (bookId: number) =>
  (await prisma.book.findUniqueOrThrow({ where: { id: bookId } })).availableCopies;

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.loan.deleteMany({
    where: { OR: [{ bookId: { in: created.bookIds } }, { memberId: { in: created.memberIds } }] },
  });
  await prisma.book.deleteMany({ where: { id: { in: created.bookIds } } });
  await prisma.member.deleteMany({ where: { id: { in: created.memberIds } } });
  await prisma.$disconnect();
});

describe('LoansService', () => {
  it('borrow decrements stock and sets dueAt 14 days after borrowedAt', async () => {
    const book = await makeBook(2);
    const member = await makeMember();

    const loan = await loans.borrow(book.id, member.id);

    expect(await stockOf(book.id)).toBe(1);
    expect(loan.returnedAt).toBeNull();
    expect(loan.dueAt.getTime() - loan.borrowedAt.getTime()).toBe(14 * 24 * 60 * 60 * 1000);
  });

  it('borrow with no stock is a conflict and leaves stock at 0', async () => {
    const book = await makeBook(1);
    const member = await makeMember();
    await loans.borrow(book.id, member.id);

    await expect(loans.borrow(book.id, member.id)).rejects.toBeInstanceOf(ConflictException);
    expect(await stockOf(book.id)).toBe(0);
  });

  it('returning twice restores stock once and second return is a conflict', async () => {
    const book = await makeBook(1);
    const member = await makeMember();
    const loan = await loans.borrow(book.id, member.id);

    const returned = await loans.giveBack(loan.id);
    expect(returned.returnedAt).not.toBeNull();
    expect(await stockOf(book.id)).toBe(1);

    await expect(loans.giveBack(loan.id)).rejects.toBeInstanceOf(ConflictException);
    expect(await stockOf(book.id)).toBe(1);
  });

  it('parallel borrows on the last copy: exactly one succeeds, stock never negative', async () => {
    const book = await makeBook(1);
    const members = await Promise.all(Array.from({ length: 5 }, () => makeMember()));

    const results = await Promise.allSettled(members.map((m) => loans.borrow(book.id, m.id)));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(4);
    expect(await stockOf(book.id)).toBe(0);
  });
});
