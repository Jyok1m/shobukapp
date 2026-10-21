import { Module } from '@nestjs/common';
import { AdminPlansController, BillingController } from './billing.controller';
import { PlansService } from './plans.service';
import { StripeService } from './stripe.service';
import { SubscriptionsService } from './subscriptions.service';
import { WebhookService } from './webhook.service';

@Module({
  controllers: [BillingController, AdminPlansController],
  providers: [
    StripeService,
    PlansService,
    SubscriptionsService,
    WebhookService,
  ],
  exports: [StripeService, SubscriptionsService],
})
export class BillingModule {}
