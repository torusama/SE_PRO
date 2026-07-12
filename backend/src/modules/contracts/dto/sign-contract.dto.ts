import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';

export class SignContractDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  signatureName!: string;

  @IsBoolean()
  accepted!: boolean;
}
