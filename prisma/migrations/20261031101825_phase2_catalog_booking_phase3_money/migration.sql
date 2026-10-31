-- CreateEnum
CREATE TYPE "ServiceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('SINGLE', 'PACKAGE', 'MEMBERSHIP');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('APP_CUSTOMER', 'ADMIN', 'WEBSITE');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'ASSIGNED', 'REASSIGNMENT_NEEDED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'RESCHEDULE_REQUESTED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_TEACHER', 'CANCELLED_BY_ADMIN', 'NO_SHOW_CUSTOMER', 'NO_SHOW_TEACHER');

-- CreateEnum
CREATE TYPE "AssignmentMode" AS ENUM ('AUTO', 'MANUAL', 'DIRECT');

-- CreateEnum
CREATE TYPE "AssignmentResponse" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RescheduleStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('CUSTOMER', 'INSTRUCTOR', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('RAZORPAY', 'WALLET', 'CASH', 'MANUAL');

-- CreateEnum
CREATE TYPE "PaymentState" AS ENUM ('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "WalletDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "WalletSource" AS ENUM ('REFUND', 'GOODWILL', 'CASHBACK', 'REFERRAL', 'BOOKING_PAYMENT', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RefundMode" AS ENUM ('WALLET', 'SOURCE');

-- CreateEnum
CREATE TYPE "RefundState" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "CommissionScope" AS ENUM ('GLOBAL', 'CATEGORY', 'SERVICE', 'INSTRUCTOR');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('PERCENT', 'FLAT');

-- CreateEnum
CREATE TYPE "EarningStatus" AS ENUM ('PENDING', 'PAYABLE', 'PAID', 'WITHHELD');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('DRAFT', 'APPROVED', 'INITIATED', 'PROCESSING', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "service_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "icon" VARCHAR(120),
    "image_url" TEXT,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "base_price" DECIMAL(10,2) NOT NULL,
    "level" "ServiceLevel" NOT NULL DEFAULT 'ALL_LEVELS',
    "max_participants" INTEGER NOT NULL DEFAULT 1,
    "equipment" TEXT,
    "description" TEXT,
    "inclusions" TEXT,
    "instructions" TEXT,
    "is_home_service" BOOLEAN NOT NULL DEFAULT true,
    "allow_extension" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_services" (
    "id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "level" "ServiceLevel" NOT NULL DEFAULT 'ALL_LEVELS',
    "custom_price" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "instructor_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_service_areas" (
    "id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "preference_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instructor_service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "session_count" INTEGER NOT NULL,
    "validity_days" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "allowed_weekdays" INTEGER[],
    "fixed_instructor_allowed" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addons" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "applicable_service_ids" UUID[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_rules" (
    "id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_overrides" (
    "id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "start_minute" INTEGER,
    "end_minute" INTEGER,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaves" (
    "id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "affected_session_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "city_id" UUID,
    "title" VARCHAR(160) NOT NULL,
    "blocks_booking" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "customer_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "package_id" UUID,
    "address_id" UUID NOT NULL,
    "type" "BookingType" NOT NULL DEFAULT 'SINGLE',
    "session_count" INTEGER NOT NULL DEFAULT 1,
    "gross_amount" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "travel_charge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "addon_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "wallet_applied" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payable" DECIMAL(10,2) NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "source" "BookingSource" NOT NULL DEFAULT 'APP_CUSTOMER',
    "preferences" JSONB,
    "hold_expires_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_addons" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "addon_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_sessions" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "service_id" UUID NOT NULL,
    "session_date" DATE NOT NULL,
    "from_minute" INTEGER NOT NULL,
    "to_minute" INTEGER NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "address_id" UUID NOT NULL,
    "instructor_id" UUID,
    "status" "SessionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "reschedule_count" INTEGER NOT NULL DEFAULT 0,
    "session_value" DECIMAL(10,2) NOT NULL,
    "check_in_otp" VARCHAR(10),
    "cancel_reason" TEXT,
    "notes_by_instructor" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "booking_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "mode" "AssignmentMode" NOT NULL DEFAULT 'AUTO',
    "offered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "response" "AssignmentResponse" NOT NULL DEFAULT 'PENDING',
    "decline_reason" TEXT,
    "score_snapshot" JSONB,
    "assigned_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "check_in_at" TIMESTAMP(3) NOT NULL,
    "check_in_lat" DECIMAL(10,7),
    "check_in_lng" DECIMAL(10,7),
    "geo_verified" BOOLEAN NOT NULL DEFAULT false,
    "otp_used" BOOLEAN NOT NULL DEFAULT true,
    "check_out_at" TIMESTAMP(3),
    "actual_duration_min" INTEGER,
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "override_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_history" (
    "id" UUID NOT NULL,
    "booking_id" UUID,
    "session_id" UUID,
    "from_status" "SessionStatus",
    "to_status" "SessionStatus" NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" UUID,
    "reason" TEXT,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reschedule_requests" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "requested_by" "ActorType" NOT NULL,
    "requested_by_id" UUID,
    "old_date" DATE NOT NULL,
    "old_from_minute" INTEGER NOT NULL,
    "old_to_minute" INTEGER NOT NULL,
    "new_date" DATE NOT NULL,
    "new_from_minute" INTEGER NOT NULL,
    "new_to_minute" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "RescheduleStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "charge_applied" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reschedule_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "group" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "gateway" "PaymentGateway" NOT NULL DEFAULT 'RAZORPAY',
    "gateway_order_id" VARCHAR(120),
    "gateway_payment_id" VARCHAR(120),
    "amount" DECIMAL(10,2) NOT NULL,
    "method" VARCHAR(60),
    "status" "PaymentState" NOT NULL DEFAULT 'CREATED',
    "paid_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "raw_payload" JSONB,
    "idempotency_key" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "invoice_no" VARCHAR(40) NOT NULL,
    "taxable_value" DECIMAL(10,2) NOT NULL,
    "tax_breakup" JSONB,
    "total" DECIMAL(10,2) NOT NULL,
    "pdf_url" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_accounts" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "direction" "WalletDirection" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "source" "WalletSource" NOT NULL,
    "reference_type" VARCHAR(60),
    "reference_id" UUID,
    "running_balance" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "session_id" UUID,
    "slab_applied" VARCHAR(60),
    "amount" DECIMAL(10,2) NOT NULL,
    "mode" "RefundMode" NOT NULL DEFAULT 'WALLET',
    "status" "RefundState" NOT NULL DEFAULT 'PENDING',
    "gateway_refund_id" VARCHAR(120),
    "approved_by_id" UUID,
    "override_reason" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_rules" (
    "id" UUID NOT NULL,
    "scope" "CommissionScope" NOT NULL,
    "category_id" UUID,
    "service_id" UUID,
    "instructor_id" UUID,
    "type" "CommissionType" NOT NULL DEFAULT 'PERCENT',
    "value" DECIMAL(10,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "earnings" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "session_value" DECIMAL(10,2) NOT NULL,
    "commission_amount" DECIMAL(10,2) NOT NULL,
    "deductions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(10,2) NOT NULL,
    "status" "EarningStatus" NOT NULL DEFAULT 'PENDING',
    "payable_from" TIMESTAMP(3),
    "withheld_reason" TEXT,
    "commission_rule_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "cycle_from" DATE NOT NULL,
    "cycle_to" DATE NOT NULL,
    "gross" DECIMAL(10,2) NOT NULL,
    "tds" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "net" DECIMAL(10,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'DRAFT',
    "utr" VARCHAR(80),
    "statement_url" TEXT,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_items" (
    "id" UUID NOT NULL,
    "payout_id" UUID NOT NULL,
    "earning_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" UUID NOT NULL,
    "gateway_settlement_id" VARCHAR(120) NOT NULL,
    "settled_on" DATE NOT NULL,
    "gross" DECIMAL(12,2) NOT NULL,
    "fees" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net" DECIMAL(12,2) NOT NULL,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "mismatch_note" TEXT,
    "reconciled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(60) NOT NULL,
    "event_id" VARCHAR(160) NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "processed_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_slug_key" ON "service_categories"("slug");

-- CreateIndex
CREATE INDEX "service_categories_is_active_sort_order_idx" ON "service_categories"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE INDEX "services_category_id_is_active_idx" ON "services"("category_id", "is_active");

-- CreateIndex
CREATE INDEX "instructor_services_service_id_is_active_idx" ON "instructor_services"("service_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "instructor_services_instructor_id_service_id_key" ON "instructor_services"("instructor_id", "service_id");

-- CreateIndex
CREATE INDEX "instructor_service_areas_area_id_idx" ON "instructor_service_areas"("area_id");

-- CreateIndex
CREATE UNIQUE INDEX "instructor_service_areas_instructor_id_area_id_key" ON "instructor_service_areas"("instructor_id", "area_id");

-- CreateIndex
CREATE INDEX "packages_service_id_is_active_idx" ON "packages"("service_id", "is_active");

-- CreateIndex
CREATE INDEX "availability_rules_instructor_id_weekday_is_active_idx" ON "availability_rules"("instructor_id", "weekday", "is_active");

-- CreateIndex
CREATE INDEX "availability_overrides_instructor_id_date_idx" ON "availability_overrides"("instructor_id", "date");

-- CreateIndex
CREATE INDEX "leaves_instructor_id_status_idx" ON "leaves"("instructor_id", "status");

-- CreateIndex
CREATE INDEX "leaves_from_date_to_date_idx" ON "leaves"("from_date", "to_date");

-- CreateIndex
CREATE INDEX "holidays_date_idx" ON "holidays"("date");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_city_id_key" ON "holidays"("date", "city_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_code_key" ON "bookings"("code");

-- CreateIndex
CREATE INDEX "bookings_customer_id_idx" ON "bookings"("customer_id");

-- CreateIndex
CREATE INDEX "bookings_payment_status_idx" ON "bookings"("payment_status");

-- CreateIndex
CREATE INDEX "bookings_hold_expires_at_idx" ON "bookings"("hold_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "booking_addons_booking_id_addon_id_key" ON "booking_addons"("booking_id", "addon_id");

-- CreateIndex
CREATE INDEX "booking_sessions_session_date_status_idx" ON "booking_sessions"("session_date", "status");

-- CreateIndex
CREATE INDEX "booking_sessions_instructor_id_session_date_idx" ON "booking_sessions"("instructor_id", "session_date");

-- CreateIndex
CREATE INDEX "booking_sessions_status_idx" ON "booking_sessions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "booking_sessions_booking_id_sequence_key" ON "booking_sessions"("booking_id", "sequence");

-- CreateIndex
CREATE INDEX "assignments_session_id_response_idx" ON "assignments"("session_id", "response");

-- CreateIndex
CREATE INDEX "assignments_instructor_id_response_idx" ON "assignments"("instructor_id", "response");

-- CreateIndex
CREATE INDEX "assignments_expires_at_idx" ON "assignments"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "check_ins_session_id_key" ON "check_ins"("session_id");

-- CreateIndex
CREATE INDEX "check_ins_instructor_id_check_in_at_idx" ON "check_ins"("instructor_id", "check_in_at");

-- CreateIndex
CREATE INDEX "booking_status_history_booking_id_idx" ON "booking_status_history"("booking_id");

-- CreateIndex
CREATE INDEX "booking_status_history_session_id_idx" ON "booking_status_history"("session_id");

-- CreateIndex
CREATE INDEX "booking_status_history_created_at_idx" ON "booking_status_history"("created_at");

-- CreateIndex
CREATE INDEX "reschedule_requests_session_id_status_idx" ON "reschedule_requests"("session_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- CreateIndex
CREATE INDEX "app_settings_group_idx" ON "app_settings"("group");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gateway_order_id_key" ON "payments"("gateway_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gateway_payment_id_key" ON "payments"("gateway_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_no_key" ON "invoices"("invoice_no");

-- CreateIndex
CREATE INDEX "invoices_booking_id_idx" ON "invoices"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_accounts_customer_id_key" ON "wallet_accounts"("customer_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_account_id_created_at_idx" ON "wallet_transactions"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "refunds_booking_id_idx" ON "refunds"("booking_id");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE INDEX "commission_rules_scope_is_active_idx" ON "commission_rules"("scope", "is_active");

-- CreateIndex
CREATE INDEX "commission_rules_effective_from_idx" ON "commission_rules"("effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "earnings_session_id_key" ON "earnings"("session_id");

-- CreateIndex
CREATE INDEX "earnings_instructor_id_status_idx" ON "earnings"("instructor_id", "status");

-- CreateIndex
CREATE INDEX "earnings_status_payable_from_idx" ON "earnings"("status", "payable_from");

-- CreateIndex
CREATE INDEX "payouts_status_idx" ON "payouts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_instructor_id_cycle_from_cycle_to_key" ON "payouts"("instructor_id", "cycle_from", "cycle_to");

-- CreateIndex
CREATE UNIQUE INDEX "payout_items_earning_id_key" ON "payout_items"("earning_id");

-- CreateIndex
CREATE INDEX "payout_items_payout_id_idx" ON "payout_items"("payout_id");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_gateway_settlement_id_key" ON "settlements"("gateway_settlement_id");

-- CreateIndex
CREATE INDEX "settlements_settled_on_idx" ON "settlements"("settled_on");

-- CreateIndex
CREATE INDEX "settlements_matched_idx" ON "settlements"("matched");

-- CreateIndex
CREATE INDEX "webhook_events_processed_at_idx" ON "webhook_events"("processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_event_id_key" ON "webhook_events"("provider", "event_id");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_services" ADD CONSTRAINT "instructor_services_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_services" ADD CONSTRAINT "instructor_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_service_areas" ADD CONSTRAINT "instructor_service_areas_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_service_areas" ADD CONSTRAINT "instructor_service_areas_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "service_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_overrides" ADD CONSTRAINT "availability_overrides_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "addons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_sessions" ADD CONSTRAINT "booking_sessions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_sessions" ADD CONSTRAINT "booking_sessions_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_sessions" ADD CONSTRAINT "booking_sessions_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_sessions" ADD CONSTRAINT "booking_sessions_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "booking_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "booking_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "booking_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "booking_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_accounts" ADD CONSTRAINT "wallet_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "wallet_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "booking_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earnings" ADD CONSTRAINT "earnings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "booking_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earnings" ADD CONSTRAINT "earnings_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_earning_id_fkey" FOREIGN KEY ("earning_id") REFERENCES "earnings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
