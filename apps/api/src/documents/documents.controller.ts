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
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser, Roles } from '../auth/decorators';
import type { SelfUser } from '../common/self-user';
import {
  DocumentsService,
  DownloadableFile,
  MAX_UPLOAD_BYTES,
} from './documents.service';
import {
  CreateDojoDocumentDto,
  CreateMemberDocumentDto,
  ListLicensesQuery,
  UpdateDocumentDto,
  UpsertLicenseDto,
} from './dto/documents.dto';

const upload = FileInterceptor('file', {
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

function download(res: Response, file: DownloadableFile): StreamableFile {
  res.set({
    'Content-Type': file.mimeType,
    'Content-Disposition': `attachment; filename="${file.filename}"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  return new StreamableFile(file.stream);
}

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@CurrentUser() user: SelfUser) {
    return this.documents.listMine(user.id);
  }

  @Post()
  @UseInterceptors(upload)
  create(
    @CurrentUser() user: SelfUser,
    @Body() dto: CreateMemberDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documents.createForMember(user, dto, file);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: SelfUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documents.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: SelfUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.documents.remove(user, id);
  }

  @Get(':id/file')
  async file(
    @CurrentUser() user: SelfUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return download(res, await this.documents.file(user, id));
  }
}

@Controller('admin/documents')
@Roles('ADMIN')
export class AdminDocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list() {
    return this.documents.listDojo();
  }

  // A member's documents, medical certificates included: owner and admins only.
  @Get('members/:userId')
  listForMember(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.documents.listMine(userId);
  }

  @Post()
  @UseInterceptors(upload)
  create(
    @CurrentUser() admin: SelfUser,
    @Body() dto: CreateDojoDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documents.createForDojo(admin, dto, file);
  }
}

@Controller('licenses')
export class LicensesController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@CurrentUser() user: SelfUser) {
    return this.documents.listMyLicenses(user.id);
  }

  @Get(':id/file')
  async file(
    @CurrentUser() user: SelfUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return download(res, await this.documents.licenseFile(user, id));
  }
}

@Controller('admin/licenses')
@Roles('ADMIN')
export class AdminLicensesController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@Query() query: ListLicensesQuery) {
    return this.documents.licenses(
      query.userId ? { userId: query.userId } : {},
    );
  }

  @Post()
  @UseInterceptors(upload)
  upsert(
    @CurrentUser() admin: SelfUser,
    @Body() dto: UpsertLicenseDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documents.upsertLicense(admin, dto, file);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.documents.removeLicense(id);
  }
}
