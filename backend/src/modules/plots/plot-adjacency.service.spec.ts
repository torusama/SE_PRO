import { BadRequestException } from '@nestjs/common';
import { PlotAdjacencyService } from './plot-adjacency.service';

describe('PlotAdjacencyService', () => {
  let service: PlotAdjacencyService;

  beforeEach(() => {
    service = new PlotAdjacencyService();
  });

  it('accepts connected touching map rectangles', () => {
    expect(
      service.validateAdjacent([
        { id: 1, code: 'A-1', mapX: 0, mapY: 0, mapWidth: 40, mapHeight: 40 },
        { id: 2, code: 'A-2', mapX: 40, mapY: 0, mapWidth: 40, mapHeight: 40 },
        { id: 3, code: 'A-3', mapX: 80, mapY: 0, mapWidth: 40, mapHeight: 40 },
      ]),
    ).toEqual({ valid: true, method: 'map' });
  });

  it('accepts small map tolerance gaps', () => {
    expect(
      service.validateAdjacent([
        { id: 1, code: 'A-1', mapX: 0, mapY: 0, mapWidth: 40, mapHeight: 40 },
        { id: 2, code: 'A-2', mapX: 41, mapY: 0, mapWidth: 40, mapHeight: 40 },
      ]),
    ).toEqual({ valid: true, method: 'map' });
  });

  it('falls back to row and column adjacency when map data is unusable', () => {
    expect(
      service.validateAdjacent([
        {
          id: 1,
          code: 'A-01-001',
          zoneId: 1,
          rowNumber: '01',
          columnNumber: '001',
          mapWidth: 0,
          mapHeight: 0,
        },
        {
          id: 2,
          code: 'A-01-002',
          zoneId: 1,
          rowNumber: '01',
          columnNumber: '002',
          mapWidth: 0,
          mapHeight: 0,
        },
      ]),
    ).toEqual({ valid: true, method: 'grid' });
  });

  it('prefers grid adjacency when map rectangles have planned aisle gaps', () => {
    expect(
      service.validateAdjacent([
        {
          id: 25,
          code: 'C-01-003',
          zoneId: 3,
          rowNumber: '01',
          columnNumber: '003',
          mapX: 190,
          mapY: 10,
          mapWidth: 80,
          mapHeight: 80,
        },
        {
          id: 28,
          code: 'C-02-003',
          zoneId: 3,
          rowNumber: '02',
          columnNumber: '003',
          mapX: 190,
          mapY: 100,
          mapWidth: 80,
          mapHeight: 80,
        },
        {
          id: 27,
          code: 'C-02-002',
          zoneId: 3,
          rowNumber: '02',
          columnNumber: '002',
          mapX: 100,
          mapY: 100,
          mapWidth: 80,
          mapHeight: 80,
        },
      ]),
    ).toEqual({ valid: true, method: 'grid' });
  });

  it('rejects disconnected selections', () => {
    expect(() =>
      service.validateAdjacent([
        { id: 1, code: 'A-1', mapX: 0, mapY: 0, mapWidth: 40, mapHeight: 40 },
        { id: 2, code: 'A-2', mapX: 100, mapY: 0, mapWidth: 40, mapHeight: 40 },
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects duplicate plot IDs', () => {
    expect(() =>
      service.validateAdjacent([
        { id: 1, code: 'A-1', mapX: 0, mapY: 0, mapWidth: 40, mapHeight: 40 },
        { id: 1, code: 'A-1', mapX: 40, mapY: 0, mapWidth: 40, mapHeight: 40 },
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects insufficient location data', () => {
    expect(() =>
      service.validateAdjacent([
        { id: 1, code: 'A-1' },
        { id: 2, code: 'A-2' },
      ]),
    ).toThrow(BadRequestException);
  });
});
