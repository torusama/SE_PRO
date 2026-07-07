import { ArrayMinSize, ArrayUnique, IsArray, IsInt, Min } from 'class-validator';
import { CreateReservationDto } from './create-reservation.dto';

export class CreateMultipleReservationDto extends CreateReservationDto {
  @IsArray()
  @ArrayMinSize(2, {
    message: 'At least two plots are required for a multi-plot reservation',
  })
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  declare plotIds: number[];
}
