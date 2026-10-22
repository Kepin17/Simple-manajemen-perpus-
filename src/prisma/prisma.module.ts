import { Module } from '@nestjs/common';
import { ENV, loadEnv } from '../config/env';
import { PrismaService } from './prisma.service';

@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv() }, PrismaService],
  exports: [PrismaService, ENV],
})
export class PrismaModule {}
