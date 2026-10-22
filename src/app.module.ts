import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { BooksModule } from './books/books.module';
import { LoansModule } from './loans/loans.module';
import { MembersModule } from './members/members.module';

@Module({
  imports: [AuthModule, BooksModule, LoansModule, MembersModule],
  controllers: [AppController],
})
export class AppModule {}
