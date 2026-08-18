import { IsString, MaxLength } from 'class-validator';
export class RejectDeceasedProfileDto {
  @IsString() @MaxLength(1000) reason: string;
}
