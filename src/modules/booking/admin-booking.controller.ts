import { Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  AllowAudience,
  CurrentUser,
  RequirePermissions,
} from '../../common/decorators/auth.decorators';
import { BookingService } from './booking.service';

/**
 * Admin booking operations. Payment confirmation lives here until the
 * Razorpay webhook exists — it is also the permanent route for recording a
 * cash or manual payment, so it does not go away afterwards.
 */
@Controller('admin')
@AllowAudience('admin')
export class AdminBookingController {
  constructor(private readonly booking: BookingService) {}

  @RequirePermissions('finance:edit')
  @Post('bookings/:id/confirm-payment')
  async confirmPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminUserId: string,
  ) {
    const result = await this.booking.confirmPayment(id, adminUserId, 'ADMIN');

    return {
      data: result,
      message: 'Payment confirmed and sessions released for assignment',
    };
  }
}
