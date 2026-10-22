import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateMemberDto } from './members.dto';
import { MembersService } from './members.service';

@Controller('members')
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(private members: MembersService) {}

  @Post()
  create(@Body() dto: CreateMemberDto) {
    return this.members.create(dto);
  }
}
