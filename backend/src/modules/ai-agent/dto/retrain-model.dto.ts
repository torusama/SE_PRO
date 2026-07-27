import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RetrainModelDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  datasetVersion?: string;
}
