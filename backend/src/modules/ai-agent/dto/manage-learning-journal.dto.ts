import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class ManageLearningJournalDto {
  @IsString()
  @MinLength(3)
  @MaxLength(220)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  summary!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  preventionRule!: string;

  @IsString()
  @IsIn(['intent', 'context', 'grounding', 'workflow', 'tone', 'conversation'])
  category!: 'intent' | 'context' | 'grounding' | 'workflow' | 'tone' | 'conversation';
}
