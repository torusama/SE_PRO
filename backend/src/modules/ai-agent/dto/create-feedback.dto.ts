import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateFeedbackDto {
  @IsString()
  @MaxLength(100)
  sessionId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  messageId?: number;

  @IsIn([
    'helpful',
    'bad_recommendation',
    'wrong_information',
    'irrelevant_answer',
    'other',
  ])
  feedbackType!:
    | 'helpful'
    | 'bad_recommendation'
    | 'wrong_information'
    | 'irrelevant_answer'
    | 'other';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  originalContent?: string;

  @ValidateIf(
    (dto: CreateFeedbackDto) => dto.feedbackType === 'wrong_information',
  )
  @IsString()
  @MaxLength(4000)
  correctedContent?: string;

  @ValidateIf(
    (dto: CreateFeedbackDto) => dto.feedbackType === 'wrong_information',
  )
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  evidenceUrl?: string;
}
