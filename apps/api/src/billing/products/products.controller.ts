import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../../auth/decorators';
import type { SelfUser } from '../../common/self-user';
import {
  RequestChargeDto,
  SetChargeStatusDto,
  UpdateProductDto,
} from './products.dto';
import { ProductsService } from './products.service';

@Controller('billing')
export class MemberProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get('products')
  list() {
    return this.products.listForMembers();
  }

  @Post('products/:id/checkout')
  @HttpCode(200)
  checkout(
    @CurrentUser() user: SelfUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.products.memberCheckout(user, id);
  }

  @Get('charges')
  charges(@CurrentUser() user: SelfUser) {
    return this.products.listMine(user.id);
  }
}

@Controller('admin')
@Roles('ADMIN')
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get('products')
  list() {
    return this.products.listAdmin();
  }

  @Patch('products/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(id, dto);
  }

  @Get('members/:id/charges')
  memberCharges(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.listForMember(id);
  }

  @Post('members/:id/charges')
  request(
    @CurrentUser() admin: SelfUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestChargeDto,
  ) {
    return this.products.request(admin, id, dto);
  }

  @Post('charges/:id/link')
  @HttpCode(200)
  sendLink(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.sendLink(id);
  }

  @Patch('charges/:id')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetChargeStatusDto,
  ) {
    return this.products.setStatus(id, dto.status);
  }
}
