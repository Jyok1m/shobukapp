import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, Roles } from '../auth/decorators';
import type { SelfUser } from '../common/self-user';
import { LicenseRequestsService } from './license-requests.service';
import {
  CreateLicenseRequestsDto,
  ExportLicenseRequestsQuery,
  ListLicenseRequestsQuery,
  UpdateLicenseRequestDto,
} from './dto/license-requests.dto';

@Controller('admin/license-requests')
@Roles('ADMIN')
export class LicenseRequestsController {
  constructor(private readonly requests: LicenseRequestsService) {}

  @Get()
  list(@Query() query: ListLicenseRequestsQuery) {
    return this.requests.list(query);
  }

  // Declared before :id so "export" is not parsed as an id.
  @Get('export')
  async export(
    @CurrentUser() admin: SelfUser,
    @Query() query: ExportLicenseRequestsQuery,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.requests.exportCsv(admin.id, query);
    const date = new Date().toISOString().slice(0, 10);
    // The season is validated as YYYY-YYYY: safe in a header.
    const season = query.season ?? 'toutes';
    res
      .set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="demandes-licences-ffjda-${season}-${date}.csv"`,
        'Cache-Control': 'no-store',
      })
      .send(csv);
  }

  @Post()
  create(
    @CurrentUser() admin: SelfUser,
    @Body() dto: CreateLicenseRequestsDto,
  ) {
    return this.requests.create(admin, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLicenseRequestDto,
  ) {
    return this.requests.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.requests.remove(id);
  }
}
