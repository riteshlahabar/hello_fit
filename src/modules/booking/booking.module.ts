import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { BookingController } from './booking.controller';
import { BookingExpiryService } from './booking-expiry.service';
import { BookingService } from './booking.service';

@Module({
  imports: [AvailabilityModule],
  controllers: [BookingController],
  providers: [BookingService, BookingExpiryService],
  exports: [BookingService],
})
export class BookingModule {}
