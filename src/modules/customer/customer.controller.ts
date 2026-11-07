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
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import {
  AllowAudience,
  CurrentUser,
  Roles,
} from '../../common/decorators/auth.decorators';
import {
  CreateAddressDto,
  UpdateAddressDto,
  UpdateCustomerProfileDto,
} from './dto/customer.dto';

/**
 * Customer profile and saved addresses.
 *
 * Every route resolves the caller's profile from the token — no id is accepted
 * from the payload or the path for ownership, so one customer cannot read or
 * edit another's address by guessing a UUID. `:addressId` is validated as a
 * UUID before it reaches a `@db.Uuid` column; a malformed one used to 500.
 */
@Controller('app/customer')
@AllowAudience('app')
@Roles('CUSTOMER')
export class CustomerController {
  constructor(private readonly customers: CustomerService) {}

  // ----------------------------------------------------------------- profile

  @Get('profile')
  async getProfile(@CurrentUser('id') userId: string) {
    return { data: await this.customers.getProfile(userId) };
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateCustomerProfileDto,
  ) {
    return {
      data: await this.customers.updateProfile(userId, dto),
      message: 'Profile updated',
    };
  }

  // --------------------------------------------------------------- addresses

  @Get('addresses')
  async listAddresses(@CurrentUser('id') userId: string) {
    const addresses = await this.customers.listAddresses(userId);
    return { data: addresses, meta: { count: addresses.length } };
  }

  @Get('addresses/:addressId')
  async getAddress(
    @CurrentUser('id') userId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    return { data: await this.customers.getAddress(userId, addressId) };
  }

  @Post('addresses')
  async createAddress(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAddressDto,
  ) {
    return {
      data: await this.customers.createAddress(userId, dto),
      message: 'Address saved',
    };
  }

  @Patch('addresses/:addressId')
  async updateAddress(
    @CurrentUser('id') userId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return {
      data: await this.customers.updateAddress(userId, addressId, dto),
      message: 'Address updated',
    };
  }

  /** Exactly one address is the default; this moves the flag atomically. */
  @Post('addresses/:addressId/default')
  @HttpCode(200)
  async setDefaultAddress(
    @CurrentUser('id') userId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    return {
      data: await this.customers.setDefaultAddress(userId, addressId),
      message: 'Default address updated',
    };
  }

  /** Soft delete. Refused while a session is still scheduled there. */
  @Delete('addresses/:addressId')
  @HttpCode(200)
  async deleteAddress(
    @CurrentUser('id') userId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    await this.customers.deleteAddress(userId, addressId);
    return { data: { id: addressId, deleted: true }, message: 'Address removed' };
  }
}
