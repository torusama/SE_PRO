import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewFeedbackDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;

  @IsOptional()
  @IsBoolean()
  applyCorrection?: boolean;
}
