import { Module } from '@nestjs/common';
import {
  AdminDocumentsController,
  AdminLicensesController,
  DocumentsController,
  LicensesController,
} from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  controllers: [
    DocumentsController,
    AdminDocumentsController,
    LicensesController,
    AdminLicensesController,
  ],
  providers: [DocumentsService],
})
export class DocumentsModule {}
