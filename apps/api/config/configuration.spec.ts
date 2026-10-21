import configuration from './configuration';

const BASE = { DATABASE_URL: 'postgresql://x@localhost:5432/x' };

function load(env: Record<string, string>) {
  const saved = { ...process.env };
  process.env = { ...BASE, ...env };
  try {
    return configuration().stripe;
  } finally {
    process.env = saved;
  }
}

describe('Stripe key slots', () => {
  it('maps the legacy pair to the slot its prefix names', () => {
    expect(
      load({ STRIPE_SECRET_KEY: 'sk_test_a', STRIPE_WEBHOOK_SECRET: 'whsec_a' })
        .test,
    ).toEqual({
      secretKey: 'sk_test_a',
      webhookSecret: 'whsec_a',
    });
  });

  it('refuses a live key outside production and in the test slot', () => {
    expect(() =>
      load({ STRIPE_LIVE_SECRET_KEY: 'sk_live_a', APP_ENV: 'staging' }),
    ).toThrow(/outside/);
    expect(() =>
      load({ STRIPE_TEST_SECRET_KEY: 'sk_live_a', APP_ENV: 'production' }),
    ).toThrow(/live key/);
    expect(() =>
      load({ STRIPE_LIVE_SECRET_KEY: 'sk_test_a', APP_ENV: 'production' }),
    ).toThrow(/sk_live_/);
  });

  it('requires each webhook secret in production, not in development', () => {
    expect(() =>
      load({ STRIPE_TEST_SECRET_KEY: 'sk_test_a', APP_ENV: 'production' }),
    ).toThrow(/webhook/);
    expect(
      load({ STRIPE_TEST_SECRET_KEY: 'sk_test_a' }).test.webhookSecret,
    ).toBeNull();
    const both = load({
      APP_ENV: 'production',
      STRIPE_TEST_SECRET_KEY: 'sk_test_a',
      STRIPE_TEST_WEBHOOK_SECRET: 'whsec_t',
      STRIPE_LIVE_SECRET_KEY: 'sk_live_a',
      STRIPE_LIVE_WEBHOOK_SECRET: 'whsec_l',
    });
    expect(both.live.secretKey).toBe('sk_live_a');
  });
});
