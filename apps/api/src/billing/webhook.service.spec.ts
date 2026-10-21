import Stripe from 'stripe';
import { WebhookService } from './webhook.service';

const SECRETS = { test: 'whsec_test', live: 'whsec_live' };
const stripe = new Stripe('sk_test_unused');

function signed(livemode: boolean, secret: string) {
  const body = JSON.stringify({
    id: `evt_${Math.random()}`,
    object: 'event',
    type: 'customer.subscription.updated',
    livemode,
    data: { object: { id: 'sub_1', object: 'subscription' } },
  });
  return {
    body: Buffer.from(body),
    header: stripe.webhooks.generateTestHeaderString({ payload: body, secret }),
  };
}

function setup() {
  const sync = jest.fn();
  const service = new WebhookService(
    {
      stripeEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    } as never,
    {
      webhookSecret: (mode: 'test' | 'live') => SECRETS[mode],
      client: () => stripe,
      configured: () => true,
    } as never,
    { syncFromStripe: sync } as never,
  );
  return { service, sync };
}

describe('WebhookService mode routing', () => {
  it('routes a live event signed by the live endpoint to the live mode', async () => {
    const { service, sync } = setup();
    const { body, header } = signed(true, SECRETS.live);
    await service.handle(body, header);
    expect(sync).toHaveBeenCalledWith('sub_1', 'live');
  });

  it('routes a test event signed by the test endpoint to the test mode', async () => {
    const { service, sync } = setup();
    const { body, header } = signed(false, SECRETS.test);
    await service.handle(body, header);
    expect(sync).toHaveBeenCalledWith('sub_1', 'test');
  });

  it('refuses an event whose mode does not match the secret that signed it', async () => {
    const { service, sync } = setup();
    const { body, header } = signed(true, SECRETS.test);
    await expect(service.handle(body, header)).rejects.toThrow();
    expect(sync).not.toHaveBeenCalled();
  });
});
