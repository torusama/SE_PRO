import { IsString, MaxLength } from 'class-validator';

export class UpdateInheritanceDto {
  @IsString()
  @MaxLength(10000)
  content!: string;
}
