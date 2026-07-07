import { Module } from '@nestjs/common';
import { PlotAdjacencyService } from './plot-adjacency.service';
import { PlotsController } from './plots.controller';
import { PlotsService } from './plots.service';

@Module({
  controllers: [PlotsController],
  providers: [PlotsService, PlotAdjacencyService],
  exports: [PlotsService, PlotAdjacencyService],
})
export class PlotsModule {}
