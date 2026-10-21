import { Module } from '@nestjs/common';
import {
  AdminBillingSettingsController,
  AdminPlansController,
  BillingController,
} from './billing.controller';
import { AuthModule } from '../auth/auth.module';
import { PlansService } from './plans.service';
import { StripeService } from './stripe.service';
import { SubscriptionsService } from './subscriptions.service';
import { WebhookService } from './webhook.service';

@Module({
  imports: [AuthModule],
  controllers: [
    BillingController,
    AdminPlansController,
    AdminBillingSettingsController,
  ],
  providers: [
    StripeService,
    PlansService,
    SubscriptionsService,
    WebhookService,
  ],
  exports: [StripeService, SubscriptionsService],
})
export class BillingModule {}
