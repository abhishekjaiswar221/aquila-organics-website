-- AlterTable
ALTER TABLE "enquiry" ADD COLUMN     "submissionId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "enquiry_submissionId_key" ON "enquiry"("submissionId");
