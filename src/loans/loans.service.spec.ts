import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { calcLateFee, LoansService } from './loans.service';

const DAY_MS = 24 * 60 * 60 * 1000;

// Tes integrasi ke PostgreSQL (DATABASE_URL). Data dibuat per-run dan dihapus di afterAll.
const prisma = new PrismaService({ databaseUrl: process.env.DATABASE_URL! } as Env);
const loans = new LoansService(prisma, { lateFeePerDay: 1000 } as Env);

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

describe('calcLateFee', () => {
  const due = new Date('2026-11-05T00:00:00Z');

  it('is 0 when returned on or before dueAt', () => {
    expect(calcLateFee(due, due, 1000)).toBe(0);
    expect(calcLateFee(due, new Date(due.getTime() - DAY_MS), 1000)).toBe(0);
  });

  it('counts whole days late times the rate', () => {
    expect(calcLateFee(due, new Date(due.getTime() + 3 * DAY_MS), 1000)).toBe(3000);
    expect(calcLateFee(due, new Date(due.getTime() + 3 * DAY_MS), 2500)).toBe(7500);
  });

  it('does not charge a partial day', () => {
    expect(calcLateFee(due, new Date(due.getTime() + DAY_MS - 1), 1000)).toBe(0);
    expect(calcLateFee(due, new Date(due.getTime() + DAY_MS + 1), 1000)).toBe(1000);
  });
});

describe('LoansService late fees (DB)', () => {
  it('giveBack after dueAt stores lateFee = whole days late * rate', async () => {
    const book = await makeBook(1);
    const member = await makeMember();
    const loan = await loans.borrow(book.id, member.id);
    await prisma.loan.update({ where: { id: loan.id }, data: { dueAt: new Date(Date.now() - 3 * DAY_MS - 1000) } });

    const returned = await loans.giveBack(loan.id);

    expect(returned.lateFee).toBe(3000);
    expect((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).lateFee).toBe(3000);
  });

  it('listOverdue includes unreturned past-due loans with running fee, and skips returned ones', async () => {
    const book = await makeBook(2);
    const member = await makeMember();
    const late = await loans.borrow(book.id, member.id);
    const returnedLate = await loans.borrow(book.id, member.id);
    const past = new Date(Date.now() - 2 * DAY_MS - 1000);
    await prisma.loan.update({ where: { id: late.id }, data: { dueAt: past } });
    await prisma.loan.update({ where: { id: returnedLate.id }, data: { dueAt: past } });
    await loans.giveBack(returnedLate.id);

    const overdue = await loans.listOverdue();
    const row = overdue.find((r) => r.id === late.id);

    expect(row?.lateFee).toBe(2000);
    expect(row?.bookTitle).toBe('Test');
    expect(overdue.some((r) => r.id === returnedLate.id)).toBe(false);
  });
});

