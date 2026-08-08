import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewKnowledgeDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}
