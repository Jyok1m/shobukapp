import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  // rawBody: the Stripe webhook signature is computed on the received bytes.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  configureApp(app);
  const PORT = process.env.PORT ?? 3001;
  await app.listen(PORT);
  new Logger('Bootstrap').log(`API listening on ${PORT}`);
}
void bootstrap();
