const APP_ENVS = ['development', 'staging', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function appEnv(): AppEnv {
  const value = process.env.APP_ENV ?? 'development';
  if (!(APP_ENVS as readonly string[]).includes(value)) {
    throw new Error(`APP_ENV must be one of ${APP_ENVS.join(', ')}`);
  }
  return value as AppEnv;
}

export type StripeKeys = {
  secretKey: string | null;
  webhookSecret: string | null;
};

/*
 * Stripe rules: docs/billing.md, section Modes. Both key pairs can be set; the
 * admin switch picks which one serves. A live key is refused outside
 * production. The legacy STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET pair still
 * works and lands in the slot its prefix names.
 */
function stripe(env: AppEnv): { test: StripeKeys; live: StripeKeys } {
  const slots = {
    test: {
      secretKey: process.env.STRIPE_TEST_SECRET_KEY || null,
      webhookSecret: process.env.STRIPE_TEST_WEBHOOK_SECRET || null,
    },
    live: {
      secretKey: process.env.STRIPE_LIVE_SECRET_KEY || null,
      webhookSecret: process.env.STRIPE_LIVE_WEBHOOK_SECRET || null,
    },
  };
  const legacy = process.env.STRIPE_SECRET_KEY || null;
  if (legacy) {
    const slot = legacy.startsWith('sk_live_') ? slots.live : slots.test;
    slot.secretKey ??= legacy;
    slot.webhookSecret ??= process.env.STRIPE_WEBHOOK_SECRET || null;
  }

  if (slots.test.secretKey?.startsWith('sk_live_')) {
    throw new Error('STRIPE_TEST_SECRET_KEY holds a live key');
  }
  if (slots.live.secretKey && !slots.live.secretKey.startsWith('sk_live_')) {
    throw new Error('STRIPE_LIVE_SECRET_KEY must be a live key (sk_live_)');
  }
  if (slots.live.secretKey && env !== 'production') {
    throw new Error('A live Stripe key is refused outside APP_ENV=production');
  }
  if (env === 'production') {
    for (const [mode, keys] of Object.entries(slots)) {
      if (keys.secretKey && !keys.webhookSecret) {
        throw new Error(
          `The ${mode} webhook secret is required with the ${mode} Stripe key`,
        );
      }
    }
  }
  return slots;
}

// Discrete variables rather than a URL: a mailbox password with URL-reserved
// characters would otherwise need encoding, and a mistake there fails silently.
function smtp() {
  const host = process.env.SMTP_HOST || null;
  if (!host) return null;
  return {
    host,
    port: parseInt(process.env.SMTP_PORT ?? '', 10) || 587,
    user: required('SMTP_USER'),
    password: required('SMTP_PASSWORD'),
  };
}

export default () => {
  const env = appEnv();
  return {
    port: parseInt(process.env.PORT ?? '', 10) || 3001,
    appEnv: env,
    webUrl: process.env.WEB_URL ?? 'http://localhost:3000',
    databaseUrl: required('DATABASE_URL'),
    sessionTtlDays: parseInt(process.env.SESSION_TTL_DAYS ?? '', 10) || 30,
    stripe: stripe(env),
    storageDir: process.env.STORAGE_DIR ?? './storage',
    smtp: smtp(),
    mailFrom:
      process.env.MAIL_FROM ?? 'Shobukan Dojo <no-reply@joachimjasmin.com>',
  };
};
