import { sniffMime } from './storage.service';

describe('sniffMime', () => {
  it('recognises the allowed types from their magic bytes', () => {
    expect(sniffMime(Buffer.from('%PDF-1.7\n'))).toBe('application/pdf');
    expect(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe(
      'image/jpeg',
    );
    expect(
      sniffMime(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
      ),
    ).toBe('image/png');
    expect(
      sniffMime(Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'latin1')),
    ).toBe('image/webp');
  });

  it('refuses anything else, whatever the browser claimed', () => {
    expect(
      sniffMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ).toBeNull();
    expect(sniffMime(Buffer.from('<html></html>'))).toBeNull();
    expect(sniffMime(Buffer.alloc(0))).toBeNull();
  });
});
