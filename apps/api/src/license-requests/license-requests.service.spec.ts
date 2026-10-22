import { licenseNumberFor, missingFields } from './license-requests.service';

const complete = {
  id: 'u1',
  firstName: 'A',
  lastName: 'B',
  email: 'a@b.c',
  birthDate: new Date('1990-01-01'),
  sex: 'FEMALE' as const,
  nationality: 'Française',
  addressLine: '255 avenue Daumesnil',
  postalCode: '75012',
  city: 'Paris',
};

describe('missingFields', () => {
  it('is empty for a complete profile', () => {
    expect(missingFields(complete)).toEqual([]);
  });

  it('reports the address once when any part of it is blank', () => {
    expect(
      missingFields({
        ...complete,
        birthDate: null,
        sex: null,
        nationality: '  ',
        postalCode: '',
        city: null,
      }),
    ).toEqual(['birthDate', 'sex', 'nationality', 'address']);
  });
});

describe('licenseNumberFor', () => {
  const licenses = [
    { season: '2024-2025', number: 'OLD' },
    { season: '2025-2026', number: 'LAST' },
    { season: '2027-2028', number: 'FUTURE' },
  ];

  it("prefers the season's own number", () => {
    expect(licenseNumberFor(licenses, '2025-2026')).toBe('LAST');
  });

  it('falls back to the latest earlier season for a renewal', () => {
    expect(licenseNumberFor(licenses, '2026-2027')).toBe('LAST');
  });

  it('is null without an earlier licence', () => {
    expect(licenseNumberFor(licenses, '2023-2024')).toBeNull();
  });
});
