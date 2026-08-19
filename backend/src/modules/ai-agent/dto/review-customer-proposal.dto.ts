import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReviewCustomerProposalDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reviewNote?: string;
}
