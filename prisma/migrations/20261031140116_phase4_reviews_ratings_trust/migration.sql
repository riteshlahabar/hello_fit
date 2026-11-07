-- CreateEnum
CREATE TYPE "ReviewAuthorType" AS ENUM ('CUSTOMER', 'INSTRUCTOR');

-- CreateEnum
CREATE TYPE "ReviewState" AS ENUM ('PENDING', 'SUBMITTED', 'PUBLISHED', 'FLAGGED', 'HIDDEN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReviewDirection" AS ENUM ('CUSTOMER_TO_INSTRUCTOR', 'INSTRUCTOR_TO_CUSTOMER');

-- CreateEnum
CREATE TYPE "ReviewReportState" AS ENUM ('OPEN', 'UPHELD', 'REJECTED');

-- CreateEnum
CREATE TYPE "RatingSubjectType" AS ENUM ('INSTRUCTOR', 'CUSTOMER');

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "author_type" "ReviewAuthorType" NOT NULL,
    "author_id" UUID NOT NULL,
    "subject_type" "RatingSubjectType" NOT NULL,
    "subject_id" UUID NOT NULL,
    "direction" "ReviewDirection" NOT NULL,
    "overall_rating" INTEGER NOT NULL,
    "comment" TEXT,
    "photos" TEXT[],
    "tags" TEXT[],
    "recommend_again" BOOLEAN,
    "confidential_note" TEXT,
    "state" "ReviewState" NOT NULL DEFAULT 'SUBMITTED',
    "submitted_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "edit_locked_at" TIMESTAMP(3),
    "flag_reason" TEXT,
    "hidden_reason" TEXT,
    "hidden_by_id" UUID,
    "reply" TEXT,
    "replied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_criteria" (
    "id" UUID NOT NULL,
    "direction" "ReviewDirection" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "review_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_criteria_scores" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "criteria_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_criteria_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_reports" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "reported_by" "ReviewAuthorType" NOT NULL,
    "reported_by_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "state" "ReviewReportState" NOT NULL DEFAULT 'OPEN',
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_aggregates" (
    "id" UUID NOT NULL,
    "subject_type" "RatingSubjectType" NOT NULL,
    "subject_id" UUID NOT NULL,
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "criteria_averages" JSONB,
    "distribution" JSONB,
    "last_recalc_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rating_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_events" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "source_review_id" UUID,
    "delta" DECIMAL(5,2) NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "resulting_score" DECIMAL(5,2) NOT NULL,
    "resulting_band" "TrustBand" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trust_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviews_subject_type_subject_id_state_idx" ON "reviews"("subject_type", "subject_id", "state");

-- CreateIndex
CREATE INDEX "reviews_state_idx" ON "reviews"("state");

-- CreateIndex
CREATE INDEX "reviews_state_created_at_idx" ON "reviews"("state", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_session_id_author_type_key" ON "reviews"("session_id", "author_type");

-- CreateIndex
CREATE INDEX "review_criteria_direction_is_active_idx" ON "review_criteria"("direction", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "review_criteria_direction_slug_key" ON "review_criteria"("direction", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "review_criteria_scores_review_id_criteria_id_key" ON "review_criteria_scores"("review_id", "criteria_id");

-- CreateIndex
CREATE INDEX "review_reports_state_idx" ON "review_reports"("state");

-- CreateIndex
CREATE INDEX "review_reports_review_id_idx" ON "review_reports"("review_id");

-- CreateIndex
CREATE UNIQUE INDEX "rating_aggregates_subject_type_subject_id_key" ON "rating_aggregates"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "trust_events_customer_id_created_at_idx" ON "trust_events"("customer_id", "created_at");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "booking_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_hidden_by_id_fkey" FOREIGN KEY ("hidden_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_criteria_scores" ADD CONSTRAINT "review_criteria_scores_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_criteria_scores" ADD CONSTRAINT "review_criteria_scores_criteria_id_fkey" FOREIGN KEY ("criteria_id") REFERENCES "review_criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_events" ADD CONSTRAINT "trust_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_events" ADD CONSTRAINT "trust_events_source_review_id_fkey" FOREIGN KEY ("source_review_id") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;
