import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsString, MaxLength, Min } from 'class-validator';
export class CreateFamilyDto {
  @IsString() @MaxLength(150) name: string;
}
export class FamilyPlotDto {
  @Type(() => Number) @IsInt() @Min(1) plotId: number;
}
export class InviteFamilyMemberDto {
  @IsEmail() @MaxLength(255) inviteeEmail: string;
}
