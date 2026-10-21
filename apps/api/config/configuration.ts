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

// Stripe rules: docs/billing.md, section Environments.
function stripe(env: AppEnv) {
  const secretKey = process.env.STRIPE_SECRET_KEY || null;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || null;
  if (secretKey) {
    if (env !== 'production' && secretKey.startsWith('sk_live_')) {
      throw new Error('A live Stripe key is refused outside APP_ENV=production');
    }
    if (env === 'production' && secretKey.startsWith('sk_test_')) {
      throw new Error('A test Stripe key is refused in APP_ENV=production');
    }
    if (env === 'production' && !webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is required with a Stripe key');
    }
  }
  return { enabled: Boolean(secretKey), secretKey, webhookSecret };
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
    smtpUrl: process.env.SMTP_URL || null,
    mailFrom:
      process.env.MAIL_FROM ?? 'Shobukan Dojo <no-reply@shobukan-dojo.com>',
  };
};
