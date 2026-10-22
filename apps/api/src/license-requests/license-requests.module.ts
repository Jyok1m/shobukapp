import { Module } from '@nestjs/common';
import { LicenseRequestsController } from './license-requests.controller';
import { LicenseRequestsService } from './license-requests.service';

@Module({
  controllers: [LicenseRequestsController],
  providers: [LicenseRequestsService],
})
export class LicenseRequestsModule {}
