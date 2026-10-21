import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StripeService } from '../billing/stripe.service';

/*
 * The single erasure path (docs/privacy.md, Rights). Order matters:
 * Stripe first (else the person keeps being charged), then the row and its
 * cascade, then the files, which no row points to anymore.
 */
@Injectable()
export class ErasureService {
  private readonly logger = new Logger(ErasureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly stripe: StripeService,
  ) {}

  async erase(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        photoKey: true,
        subscriptions: {
          where: { status: { notIn: ['canceled', 'incomplete_expired'] } },
          select: { stripeSubscriptionId: true },
        },
        documents: { select: { storageKey: true } },
        licenses: { select: { storageKey: true } },
      },
    });
    if (!user) throw new NotFoundException({ code: 'member_not_found' });

    if (user.subscriptions.length) {
      const stripe = this.stripe.require();
      for (const { stripeSubscriptionId } of user.subscriptions) {
        // Immediately, without proration: nobody remains to use it.
        try {
          await stripe.subscriptions.cancel(stripeSubscriptionId);
        } catch (error) {
          // Already gone at Stripe (a previous partial erasure): nothing to stop.
          if (
            !(error instanceof Stripe.errors.StripeError) ||
            error.code !== 'resource_missing'
          ) {
            throw error;
          }
        }
      }
    }

    const keys = [
      user.photoKey,
      ...user.documents.map((d) => d.storageKey),
      ...user.licenses.map((l) => l.storageKey),
    ].filter((key): key is string => Boolean(key));

    await this.prisma.user.delete({ where: { id: userId } });

    for (const key of keys) {
      await this.storage.remove(key);
    }
    this.logger.log(`Erased user ${userId} (${keys.length} files)`);
  }
}
