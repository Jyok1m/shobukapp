import Stripe from 'stripe';
import { ErasureService } from './erasure.service';

function setup(cancel: jest.Mock) {
  const calls: string[] = [];
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        photoKey: 'photo-key',
        subscriptions: [{ stripeSubscriptionId: 'sub_1', livemode: false }],
        documents: [{ storageKey: 'doc-key' }],
        licenses: [{ storageKey: null }],
      }),
      delete: jest.fn().mockImplementation(() => calls.push('delete-row')),
    },
  };
  const storage = {
    remove: jest
      .fn()
      .mockImplementation((key: string) => calls.push(`remove-${key}`)),
  };
  cancel.mockImplementation(() => {
    calls.push('cancel-stripe');
    return Promise.resolve();
  });
  const service = new ErasureService(
    prisma as never,
    storage as never,
    { client: () => ({ subscriptions: { cancel } }) } as never,
  );
  return { service, calls, prisma, storage };
}

describe('ErasureService', () => {
  it('cancels Stripe, then deletes the row, then the files', async () => {
    const { service, calls } = setup(jest.fn());
    await service.erase('user-1');
    expect(calls).toEqual([
      'cancel-stripe',
      'delete-row',
      'remove-photo-key',
      'remove-doc-key',
    ]);
  });

  it('aborts before touching data when Stripe fails', async () => {
    const cancel = jest.fn();
    const { service, prisma, storage } = setup(cancel);
    cancel.mockRejectedValue(new Error('network down'));
    await expect(service.erase('user-1')).rejects.toThrow('network down');
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('treats a subscription already gone at Stripe as cancelled', async () => {
    const cancel = jest.fn();
    const { service, prisma } = setup(cancel);
    cancel.mockRejectedValue(
      Stripe.errors.StripeError.generate({
        type: 'invalid_request_error',
        code: 'resource_missing',
        message: 'No such subscription',
      }),
    );
    await service.erase('user-1');
    expect(prisma.user.delete).toHaveBeenCalled();
  });
});
