import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from '../config/configuration';
import { AppController } from './app.controller';
import { AdminMembersModule } from './admin-members/admin-members.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { AppThrottlerGuard } from './common/throttler.guard';
import { RolesGuard, SessionGuard } from './auth/guards';
import { DocumentsModule } from './documents/documents.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    StorageModule,
    MailModule,
    AuthModule,
    UsersModule,
    BillingModule,
    AdminMembersModule,
    DocumentsModule,
  ],
  controllers: [AppController],
  // Order matters: SessionGuard sets req.user, RolesGuard reads it.
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
