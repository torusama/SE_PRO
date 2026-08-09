import { IsDateString } from 'class-validator';

export class SetServiceOrderRequestedDateDto {
  @IsDateString()
  requestedDate!: string;
}
