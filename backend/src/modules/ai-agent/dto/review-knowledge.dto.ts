import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReviewKnowledgeDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reviewNote?: string;
}
