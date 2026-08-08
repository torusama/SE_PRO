import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min } from 'class-validator';
export class CreateFamilyDto {
  @IsString() @MaxLength(150) name: string;
}
export class FamilyPlotDto {
  @Type(() => Number) @IsInt() @Min(1) plotId: number;
}
export class InviteFamilyMemberDto {
  @Type(() => Number) @IsInt() @Min(1) inviteeUserId: number;
}
