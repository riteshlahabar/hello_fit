import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { AdminAssignmentController } from './admin-assignment.controller';
import { AssignmentService } from './assignment.service';
import { OfferExpiryService } from './offer-expiry.service';

@Module({
  imports: [AvailabilityModule],
  controllers: [AdminAssignmentController],
  providers: [AssignmentService, OfferExpiryService],
  exports: [AssignmentService],
})
export class AssignmentModule {}
