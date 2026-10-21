import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { isUUID } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators';
import type { SelfUser } from '../common/self-user';
import { UpdateMyProfileDto } from './dto/profile.dto';
import { UsersService } from './users.service';

const photoUpload = FileInterceptor('file', {
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: SelfUser): SelfUser {
    return user;
  }

  @Patch('me')
  update(
    @CurrentUser() user: SelfUser,
    @Body() dto: UpdateMyProfileDto,
  ): Promise<SelfUser> {
    return this.users.updateProfile(user.id, dto);
  }

  @Post('me/photo')
  @UseInterceptors(photoUpload)
  setPhoto(
    @CurrentUser() user: SelfUser,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<SelfUser> {
    if (!file) throw new BadRequestException({ code: 'file_required' });
    return this.users.setPhoto(user.id, file.buffer);
  }

  @Delete('me/photo')
  removePhoto(@CurrentUser() user: SelfUser): Promise<SelfUser> {
    return this.users.removePhoto(user.id);
  }

  @Get('members')
  directory(@Query('cursor') cursor?: string) {
    if (cursor !== undefined && !isUUID(cursor)) {
      throw new BadRequestException({ code: 'invalid_cursor' });
    }
    return this.users.directory(cursor);
  }

  @Get('members/:id/photo')
  async photo(
    @CurrentUser() viewer: SelfUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, mime } = await this.users.photo(viewer, id);
    res
      .set({
        'Content-Type': mime,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(buffer);
  }
}
