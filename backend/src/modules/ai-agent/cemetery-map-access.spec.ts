import { calculatePlotEntranceAccess } from './cemetery-map-access';

describe('cemetery customer-map entrance access', () => {
  it('uses the customer plot-code layout instead of legacy database geometry', () => {
    const far = calculatePlotEntranceAccess({
      plotCode: 'A-01-001',
      zoneName: 'Khu A',
      rowNumber: '1',
      columnNumber: '1',
    });
    const near = calculatePlotEntranceAccess({
      plotCode: 'H-06-001',
      zoneName: 'Khu H',
      rowNumber: '6',
      columnNumber: '1',
    });

    expect(near.nearestEntrance).toBe('main');
    expect(near.entranceProximity).toBe('near');
    expect(near.entranceDistanceMapUnits).toBeLessThan(
      far.entranceDistanceMapUnits!,
    );
  });

  it('maps lower family rows toward the secondary gate', () => {
    const access = calculatePlotEntranceAccess({
      plotCode: 'C-20-005',
      zoneName: 'Khu C',
      rowNumber: '20',
      columnNumber: '5',
    });

    expect(access.nearestEntrance).toBe('secondary');
    expect(access.entranceProximity).toBe('near');
  });
});
