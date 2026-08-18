import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDeceasedProfileDto {
  @Type(() => Number) @IsInt() @Min(1) plotId: number;
  @IsString() @MaxLength(100) fullName: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsDateString() dateOfDeath?: string;
  @IsOptional() @IsDateString() burialDate?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() @MaxLength(255) hometown?: string;
  @IsOptional() @IsString() @MaxLength(10000) biography?: string;
  @IsOptional() @IsInt() @Min(1) anniversaryMonth?: number;
  @IsOptional() @IsInt() @Min(1) anniversaryDay?: number;
}
export class UpdateDeceasedProfileDto extends CreateDeceasedProfileDto {
  @IsOptional() declare plotId: number;
  @IsOptional() declare fullName: string;
}
export class DeceasedProfileQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() plotId?: number;
  @IsOptional() @Type(() => Number) @IsInt() familyId?: number;
  @IsOptional() @IsString() verificationStatus?: string;
  get offset() {
    return (this.page - 1) * this.pageSize;
  }
}
export class ConfigurePlotCapacityDto {
  @Type(() => Number) @IsInt() @Min(1) capacity: number;
}
