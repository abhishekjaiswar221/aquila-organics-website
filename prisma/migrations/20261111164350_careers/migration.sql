-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('NEW', 'REVIEWING', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED');

-- CreateTable
CREATE TABLE "job_opening" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "department" TEXT,
    "employmentType" "EmploymentType" NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "closesOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_opening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_application" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reference" TEXT NOT NULL,
    "submissionId" UUID,
    "jobId" UUID,
    "jobTitleSnapshot" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT,
    "message" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_file" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "applicationId" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_file_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_opening_slug_key" ON "job_opening"("slug");

-- CreateIndex
CREATE INDEX "job_opening_status_idx" ON "job_opening"("status");

-- CreateIndex
CREATE UNIQUE INDEX "job_application_reference_key" ON "job_application"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "job_application_submissionId_key" ON "job_application"("submissionId");

-- CreateIndex
CREATE INDEX "job_application_status_createdAt_idx" ON "job_application"("status", "createdAt");

-- CreateIndex
CREATE INDEX "job_application_jobId_idx" ON "job_application"("jobId");

-- CreateIndex
CREATE INDEX "job_application_createdAt_idx" ON "job_application"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "application_file_storageKey_key" ON "application_file"("storageKey");

-- CreateIndex
CREATE INDEX "application_file_applicationId_idx" ON "application_file"("applicationId");

-- AddForeignKey
ALTER TABLE "job_application" ADD CONSTRAINT "job_application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job_opening"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_file" ADD CONSTRAINT "application_file_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "job_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
