import {
  bytesToMb,
  getProcessMemorySnapshot,
  roundToOneDecimal,
  withMemoryDelta,
} from './request.utils';

describe('request.utils memory snapshot', () => {
  it('bytesToMb arredonda para 1 casa decimal', () => {
    expect(bytesToMb(0)).toBe(0);
    expect(bytesToMb(1024 * 1024)).toBe(1);
    expect(bytesToMb(1.54 * 1024 * 1024)).toBe(1.5);
    expect(bytesToMb(1.56 * 1024 * 1024)).toBe(1.6);
  });

  it('getProcessMemorySnapshot retorna valores finitos em MB', () => {
    const snapshot = getProcessMemorySnapshot();

    expect(snapshot.rssMb).toBeGreaterThan(0);
    expect(snapshot.heapUsedMb).toBeGreaterThan(0);
    expect(snapshot.heapTotalMb).toBeGreaterThanOrEqual(snapshot.heapUsedMb);
    expect(Number.isFinite(snapshot.externalMb)).toBe(true);
  });

  it('withMemoryDelta calcula variação de rss e heapUsed', () => {
    const started = {
      rssMb: 180.2,
      heapUsedMb: 90.4,
      heapTotalMb: 120,
      externalMb: 10,
    };
    const ended = {
      rssMb: 210.7,
      heapUsedMb: 88.1,
      heapTotalMb: 130,
      externalMb: 12,
    };

    expect(withMemoryDelta(started, ended)).toEqual({
      ...ended,
      rssDeltaMb: roundToOneDecimal(30.5),
      heapUsedDeltaMb: roundToOneDecimal(-2.3),
    });
  });
});
