import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';
import { CreateReservationDto } from './create-reservation.dto';

export class CreateMultipleReservationDto extends CreateReservationDto {
  @IsArray()
  @ArrayMinSize(2, {
    message: 'Vui lòng chọn ít nhất hai lô cho yêu cầu nhiều lô',
  })
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  declare plotIds: number[];
}
