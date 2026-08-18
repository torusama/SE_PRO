import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ReviewFeedbackDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reviewNote: string;

  @IsOptional()
  @IsBoolean()
  applyCorrection?: boolean;
}
