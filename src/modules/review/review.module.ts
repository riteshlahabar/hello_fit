import { Module } from '@nestjs/common';
import {
  AdminReviewController,
  CustomerReviewController,
  InstructorReviewController,
  PublicReviewController,
} from './review.controller';
import { ReviewService } from './review.service';
import { ReviewWindowService } from './review-window.service';

@Module({
  controllers: [
    CustomerReviewController,
    InstructorReviewController,
    PublicReviewController,
    AdminReviewController,
  ],
  providers: [ReviewService, ReviewWindowService],
  exports: [ReviewService],
})
export class ReviewModule {}
