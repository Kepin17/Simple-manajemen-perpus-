import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { BorrowDto } from './loans.dto';
import { LoansService } from './loans.service';

@Controller('loans')
@UseGuards(JwtAuthGuard)
export class LoansController {
  constructor(private loans: LoansService) {}

  @Post()
  borrow(@Body() dto: BorrowDto) {
    return this.loans.borrow(dto.bookId, dto.memberId);
  }

  @Post(':id/return')
  @HttpCode(200)
  giveBack(@Param('id', ParseIntPipe) id: number) {
    return this.loans.giveBack(id);
  }

  @Get()
  listByMember(@Query('memberId', ParseIntPipe) memberId: number) {
    return this.loans.listByMember(memberId);
  }
}
