import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAiDraftDto {
  @IsString()
  @MaxLength(100)
  sessionId!: string;

  @IsString()
  @MaxLength(100)
  optionId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @Type(() => Number)
  @IsInt({ each: true })
  plotIds!: number[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
