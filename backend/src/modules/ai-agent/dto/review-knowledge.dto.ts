import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReviewKnowledgeDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reviewNote: string;
}
