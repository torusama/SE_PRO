import { IsInt, Min } from 'class-validator';

export class PlotIntroductionDto {
  @IsInt()
  @Min(1)
  plotId!: number;
}
