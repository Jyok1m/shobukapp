import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { StripeErrorFilter } from './common/stripe-error.filter';

// Shared by main.ts and the e2e tests, so both run the same pipeline.
export function configureApp(app: NestExpressApplication): void {
  app.use(cookieParser());
  app.useGlobalFilters(new StripeErrorFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
