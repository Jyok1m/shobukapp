import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import Stripe from 'stripe';

// Stripe messages describe our integration, not the user's action: log them,
// answer a stable code.
@Catch(Stripe.errors.StripeError)
export class StripeErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Stripe');

  catch(
    error: InstanceType<typeof Stripe.errors.StripeError>,
    host: ArgumentsHost,
  ) {
    this.logger.error(`${error.type}: ${error.message}`);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.BAD_GATEWAY)
      .json({ statusCode: HttpStatus.BAD_GATEWAY, code: 'stripe_error' });
  }
}
