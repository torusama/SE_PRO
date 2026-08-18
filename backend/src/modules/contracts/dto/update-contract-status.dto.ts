import { IsIn } from 'class-validator';

export class UpdateContractStatusDto {
  @IsIn(['draft', 'active', 'expired', 'transferred', 'cancelled'])
  status!: string;
}
