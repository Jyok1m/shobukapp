import { currentSeason } from './season';

describe('currentSeason', () => {
  it('starts a season on 1 September, Paris time', () => {
    expect(currentSeason(new Date('2026-08-31T21:59:00Z'))).toBe('2025-2026');
    expect(currentSeason(new Date('2026-08-31T22:00:00Z'))).toBe('2026-2027');
    expect(currentSeason(new Date('2027-01-15T12:00:00Z'))).toBe('2026-2027');
  });
});
