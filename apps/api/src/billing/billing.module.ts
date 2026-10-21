import { Module } from '@nestjs/common';
import {
  AdminBillingSettingsController,
  AdminPlansController,
  BillingController,
} from './billing.controller';
import {
  AdminProductsController,
  MemberProductsController,
} from './products/products.controller';
import { ProductsService } from './products/products.service';
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
    MemberProductsController,
    AdminProductsController,
  ],
  providers: [
    StripeService,
    PlansService,
    SubscriptionsService,
    WebhookService,
    ProductsService,
  ],
  exports: [StripeService, SubscriptionsService, PlansService, ProductsService],
})
export class BillingModule {}
