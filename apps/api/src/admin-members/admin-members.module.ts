import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { AdminMembersController } from './admin-members.controller';
import { AdminMembersService } from './admin-members.service';
import { ErasureService } from './erasure.service';

@Module({
  imports: [BillingModule],
  controllers: [AdminMembersController],
  providers: [AdminMembersService, ErasureService],
  exports: [ErasureService],
})
export class AdminMembersModule {}
