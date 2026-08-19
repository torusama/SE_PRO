import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ManageUserMemoryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reviewNote?: string;
}
