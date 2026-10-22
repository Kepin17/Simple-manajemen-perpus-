import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { CreateBookDto } from './books.dto';

@Injectable()
export class BooksService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.book.findMany({ orderBy: { id: 'asc' } });
  }

  async create(dto: CreateBookDto) {
    try {
      return await this.prisma.book.create({
        data: { ...dto, availableCopies: dto.totalCopies },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('ISBN already exists');
      }
      throw err;
    }
  }

  async findOne(id: number) {
    const book = await this.prisma.book.findUnique({ where: { id } });
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }
}
