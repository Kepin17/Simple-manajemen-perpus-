import { IsInt, Min } from 'class-validator';

export class BorrowDto {
  @IsInt()
  @Min(1)
  bookId!: number;

  @IsInt()
  @Min(1)
  memberId!: number;
}
