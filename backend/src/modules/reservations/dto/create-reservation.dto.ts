import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateReservationDto {
  @IsIn(['reserve', 'purchase'])
  type: string;

  @IsArray()
  @ArrayMinSize(1)
  plotIds: number[];

  @IsOptional()
  @IsString()
  note?: string;
}
