import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { CaseType } from '../change-right-policy';

export class CreateChangeRightCaseDto {
  @IsIn(['TRANSFER', 'INHERITANCE'])
  caseType!: CaseType;

  @IsInt()
  @Min(1)
  plotId!: number;

  @IsInt()
  @Min(1)
  sourceContractId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customerReason?: string;
}
