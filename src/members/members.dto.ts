import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  // Digit saja, tanpa '+'. Maksimal 15 digit (format E.164).
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,15}$/, { message: 'phone must be digits only, without +, max 15 digits' })
  phone?: string;
}
