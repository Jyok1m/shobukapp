import { AppController } from './app.controller';

describe('AppController', () => {
  it('reports health', () => {
    expect(new AppController().health()).toEqual({ status: 'ok' });
  });
});
