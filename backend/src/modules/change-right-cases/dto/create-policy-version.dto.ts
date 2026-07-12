import { IsObject, IsString, MaxLength, MinLength } from 'class-validator';
import type { ChangeRightPolicyConfiguration } from '../change-right-policy';

export class CreatePolicyVersionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  code!: string;

  @IsObject()
  configuration!: ChangeRightPolicyConfiguration;
}
