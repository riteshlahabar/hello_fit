-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "admin_user_id" UUID,
ALTER COLUMN "user_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "refresh_tokens_admin_user_id_idx" ON "refresh_tokens"("admin_user_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
