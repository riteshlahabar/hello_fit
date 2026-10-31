import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  AdminLoginDto,
  RefreshTokenDto,
  SendOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import {
  AllowAudience,
  CurrentUser,
  Public,
} from '../../common/decorators/auth.decorators';

/** App authentication — mobile OTP (spec 8, auth module). */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Throttled per IP on top of the per-mobile limit inside OtpService: one
   * stops a single number being spammed, the other stops one host walking
   * through many numbers.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() dto: SendOtpDto, @Ip() ip: string) {
    const data = await this.auth.sendLoginOtp(dto, ip);
    return { data, message: 'OTP sent' };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto, @Ip() ip: string) {
    const data = await this.auth.verifyLoginOtp(dto, ip);
    return { data, message: 'Signed in' };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    const data = await this.auth.refresh(dto.refreshToken);
    return { data, message: 'Token refreshed' };
  }

  @AllowAudience('app')
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body() dto: RefreshTokenDto,
    @CurrentUser('deviceId') deviceId?: string,
  ) {
    await this.auth.logout(dto.refreshToken, deviceId);
    return { data: null, message: 'Signed out' };
  }
}

/** Admin panel authentication — email + password, separate from app login. */
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: AdminLoginDto) {
    const data = await this.auth.adminLogin(dto);
    return { data, message: 'Signed in' };
  }

  @AllowAudience('admin')
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshTokenDto) {
    await this.auth.logout(dto.refreshToken);
    return { data: null, message: 'Signed out' };
  }
}
