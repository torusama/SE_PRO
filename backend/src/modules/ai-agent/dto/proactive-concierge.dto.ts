import { IsBoolean, IsOptional } from 'class-validator';

export class ProactiveConciergeDto {
  @IsOptional()
  @IsBoolean()
  startNew?: boolean;
}
