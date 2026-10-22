import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { BooksService } from './books.service';
import { CreateBookDto } from './books.dto';

@Controller('books')
@UseGuards(JwtAuthGuard)
export class BooksController {
  constructor(private books: BooksService) {}

  @Get()
  list() {
    return this.books.list();
  }

  @Post()
  create(@Body() dto: CreateBookDto) {
    return this.books.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.books.findOne(id);
  }
}
