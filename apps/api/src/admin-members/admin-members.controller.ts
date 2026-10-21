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
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser, Roles } from '../auth/decorators';
import type { SelfUser } from '../common/self-user';
import { UpdateProfileDto } from '../users/dto/profile.dto';
import { AdminMembersService } from './admin-members.service';
import {
  ChangeRoleDto,
  CreateMemberDto,
  ListMembersQuery,
  ReminderDto,
} from './dto/admin-members.dto';

@Controller('admin/members')
@Roles('ADMIN')
export class AdminMembersController {
  constructor(private readonly members: AdminMembersService) {}

  @Post()
  create(@CurrentUser() admin: SelfUser, @Body() dto: CreateMemberDto) {
    return this.members.createMember(admin, dto);
  }

  @Get()
  list(@Query() query: ListMembersQuery) {
    return this.members.list(query);
  }

  // Declared before :id so "export" is not parsed as an id.
  @Get('export')
  async export(
    @CurrentUser() admin: SelfUser,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.members.exportCsv(admin.id);
    const date = new Date().toISOString().slice(0, 10);
    res
      .set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="membres-shobukan-${date}.csv"`,
        'Cache-Control': 'no-store',
      })
      .send(csv);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.members.detail(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<SelfUser> {
    return this.members.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() admin: SelfUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.members.remove(admin.id, id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Patch(':id/role')
  changeRole(
    @CurrentUser() admin: SelfUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.members.changeRole(admin, id, dto.role, dto.password);
  }

  @Post(':id/reminders')
  remind(
    @CurrentUser() admin: SelfUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReminderDto,
  ) {
    return this.members.remind(admin.id, id, dto.note);
  }
}
