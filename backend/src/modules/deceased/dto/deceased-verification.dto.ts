import { IsOptional, IsString, MaxLength } from 'class-validator';
export class RejectDeceasedProfileDto {
  @IsString() @MaxLength(1000) reason: string;
}
export class RequestDeletionDto {
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}
export class DenyDeletionDto {
  @IsString() @MaxLength(1000) reason: string;
}
