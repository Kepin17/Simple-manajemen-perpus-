import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateBookDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  author!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  isbn!: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  totalCopies!: number;
}
