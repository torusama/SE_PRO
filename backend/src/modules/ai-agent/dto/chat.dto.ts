import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AgentClientActionDto {
  @IsIn(['START_PLOT_REQUEST', 'START_SERVICE_ORDER'])
  type!: 'START_PLOT_REQUEST' | 'START_SERVICE_ORDER';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  optionId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  plotIds?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsString({ each: true })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter(Boolean)
      : value,
  )
  plotCodes?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  serviceTypeId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  serviceName?: string;
}

export class ChatDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sessionId?: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AgentClientActionDto)
  clientAction?: AgentClientActionDto;
}
