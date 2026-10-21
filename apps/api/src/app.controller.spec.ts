import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';

describe('AppController', () => {
  it('reports health', () => {
    expect(new AppController({} as never).health()).toEqual({ status: 'ok' });
  });

  it('reports ready only when the database answers', async () => {
    const up = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    await expect(new AppController(up as never).ready()).resolves.toEqual({
      status: 'ok',
    });
    const down = { $queryRaw: jest.fn().mockRejectedValue(new Error('down')) };
    await expect(new AppController(down as never).ready()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
