-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'USER', 'READONLY');

-- CreateEnum
CREATE TYPE "public"."VulnerabilitySeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "public"."VulnerabilitySource" AS ENUM ('SENTINELONE', 'NINJAONE', 'MICROSOFT_GRAPH', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."VulnerabilityStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'FALSE_POSITIVE', 'ACCEPTED_RISK');

-- CreateEnum
CREATE TYPE "public"."ComplianceStatus" AS ENUM ('COMPLIANT', 'NON_COMPLIANT', 'PARTIAL', 'NOT_APPLICABLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."ApiSource" AS ENUM ('SENTINELONE', 'NINJAONE', 'MICROSOFT_GRAPH');

-- CreateEnum
CREATE TYPE "public"."SyncStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentinelOneSiteId" TEXT,
    "ninjaOneOrganizationId" TEXT,
    "proofpointOrganizationId" TEXT,
    "sentinelOneLastSync" TIMESTAMP(3),
    "ninjaOneLastSync" TIMESTAMP(3),
    "msGraphLastSync" TIMESTAMP(3),

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Endpoint" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT,
    "sentinelOneAgentId" TEXT,
    "ninjaOneDeviceId" TEXT,
    "azureDeviceId" TEXT,
    "operatingSystem" TEXT,
    "osVersion" TEXT,
    "ipAddress" TEXT,
    "macAddress" TEXT,
    "lastSeen" TIMESTAMP(3),
    "isCompliant" BOOLEAN NOT NULL DEFAULT false,
    "complianceScore" INTEGER,
    "criticalVulns" INTEGER NOT NULL DEFAULT 0,
    "highVulns" INTEGER NOT NULL DEFAULT 0,
    "mediumVulns" INTEGER NOT NULL DEFAULT 0,
    "lowVulns" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "osName" TEXT,
    "osRevision" TEXT,
    "osType" TEXT,
    "osArch" TEXT,
    "osStartTime" TIMESTAMP(3),
    "osUsername" TEXT,
    "serialNumber" TEXT,
    "modelName" TEXT,
    "totalMemory" INTEGER,
    "coreCount" INTEGER,
    "cpuCount" INTEGER,
    "cpuId" TEXT,
    "sentinelOneAgentVersion" TEXT,
    "agentLastActiveDate" TIMESTAMP(3),
    "isAgentActive" BOOLEAN NOT NULL DEFAULT false,
    "isAgentUpToDate" BOOLEAN NOT NULL DEFAULT false,
    "agentRegisteredAt" TIMESTAMP(3),
    "activeThreats" INTEGER NOT NULL DEFAULT 0,
    "isInfected" BOOLEAN NOT NULL DEFAULT false,
    "detectionState" TEXT,
    "firewallEnabled" BOOLEAN NOT NULL DEFAULT false,
    "encryptedApplications" BOOLEAN NOT NULL DEFAULT false,
    "threatRebootRequired" BOOLEAN NOT NULL DEFAULT false,
    "lastSuccessfulScan" TIMESTAMP(3),
    "scanStatus" TEXT,
    "userActionsNeeded" TEXT[],
    "missingPermissions" TEXT[],
    "domain" TEXT,
    "externalIp" TEXT,
    "lastIpToMgmt" TEXT,
    "networkQuarantineEnabled" BOOLEAN NOT NULL DEFAULT false,
    "adComputerDistinguishedName" TEXT,
    "adComputerMemberOf" TEXT[],
    "adLastUserDistinguishedName" TEXT,
    "adUserPrincipalName" TEXT,
    "windowsCompliant" BOOLEAN NOT NULL DEFAULT false,
    "windowsComplianceScore" INTEGER,
    "lastWindowsCheck" TIMESTAMP(3),
    "appsVulnerabilityStatus" TEXT,

    CONSTRAINT "Endpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EndpointSource" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceData" JSONB,
    "lastSynced" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EndpointSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Vulnerability" (
    "id" TEXT NOT NULL,
    "cveId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "public"."VulnerabilitySeverity" NOT NULL,
    "cvssScore" DOUBLE PRECISION,
    "vendor" TEXT,
    "product" TEXT,
    "version" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vulnerability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EndpointVulnerability" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "vulnerabilityId" TEXT NOT NULL,
    "detectedBy" "public"."VulnerabilitySource" NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."VulnerabilityStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "EndpointVulnerability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ComplianceFramework" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceFramework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ComplianceCheck" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "checkName" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "status" "public"."ComplianceStatus" NOT NULL,
    "lastChecked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidence" TEXT,
    "remediation" TEXT,

    CONSTRAINT "ComplianceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SyncJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" "public"."ApiSource" NOT NULL,
    "status" "public"."SyncStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "errorDetails" TEXT,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "tenantId" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "refresh_token_expires_in" INTEGER,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."WindowsComplianceRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "requireLatestGA" BOOLEAN NOT NULL DEFAULT true,
    "maxVersionsBehind" INTEGER NOT NULL DEFAULT 1,
    "maxDaysBehindSecurity" INTEGER NOT NULL DEFAULT 30,
    "allowPreview" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WindowsComplianceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Application" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "hasKnownVulns" BOOLEAN NOT NULL DEFAULT false,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "isMonitored" BOOLEAN NOT NULL DEFAULT true,
    "requiresUpdates" BOOLEAN NOT NULL DEFAULT true,
    "latestVersion" TEXT,
    "latestVersionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "public"."Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "public"."Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_sentinelOneSiteId_idx" ON "public"."Tenant"("sentinelOneSiteId");

-- CreateIndex
CREATE INDEX "Client_tenantId_idx" ON "public"."Client"("tenantId");

-- CreateIndex
CREATE INDEX "Endpoint_osRevision_idx" ON "public"."Endpoint"("osRevision");

-- CreateIndex
CREATE INDEX "Endpoint_activeThreats_idx" ON "public"."Endpoint"("activeThreats");

-- CreateIndex
CREATE INDEX "Endpoint_isInfected_idx" ON "public"."Endpoint"("isInfected");

-- CreateIndex
CREATE INDEX "Endpoint_userActionsNeeded_idx" ON "public"."Endpoint"("userActionsNeeded");

-- CreateIndex
CREATE INDEX "Endpoint_tenantId_idx" ON "public"."Endpoint"("tenantId");

-- CreateIndex
CREATE INDEX "Endpoint_clientId_idx" ON "public"."Endpoint"("clientId");

-- CreateIndex
CREATE INDEX "Endpoint_sentinelOneAgentId_idx" ON "public"."Endpoint"("sentinelOneAgentId");

-- CreateIndex
CREATE INDEX "Endpoint_ninjaOneDeviceId_idx" ON "public"."Endpoint"("ninjaOneDeviceId");

-- CreateIndex
CREATE INDEX "Endpoint_lastSeen_idx" ON "public"."Endpoint"("lastSeen");

-- CreateIndex
CREATE UNIQUE INDEX "Endpoint_tenantId_hostname_key" ON "public"."Endpoint"("tenantId", "hostname");

-- CreateIndex
CREATE INDEX "EndpointSource_sourceType_idx" ON "public"."EndpointSource"("sourceType");

-- CreateIndex
CREATE INDEX "EndpointSource_sourceId_idx" ON "public"."EndpointSource"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "EndpointSource_endpointId_sourceType_key" ON "public"."EndpointSource"("endpointId", "sourceType");

-- CreateIndex
CREATE INDEX "Vulnerability_severity_idx" ON "public"."Vulnerability"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "Vulnerability_cveId_key" ON "public"."Vulnerability"("cveId");

-- CreateIndex
CREATE INDEX "EndpointVulnerability_status_idx" ON "public"."EndpointVulnerability"("status");

-- CreateIndex
CREATE INDEX "EndpointVulnerability_detectedAt_idx" ON "public"."EndpointVulnerability"("detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EndpointVulnerability_endpointId_vulnerabilityId_key" ON "public"."EndpointVulnerability"("endpointId", "vulnerabilityId");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceFramework_name_key" ON "public"."ComplianceFramework"("name");

-- CreateIndex
CREATE INDEX "ComplianceCheck_status_idx" ON "public"."ComplianceCheck"("status");

-- CreateIndex
CREATE INDEX "ComplianceCheck_lastChecked_idx" ON "public"."ComplianceCheck"("lastChecked");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceCheck_endpointId_frameworkId_checkId_key" ON "public"."ComplianceCheck"("endpointId", "frameworkId", "checkId");

-- CreateIndex
CREATE INDEX "SyncJob_tenantId_source_idx" ON "public"."SyncJob"("tenantId", "source");

-- CreateIndex
CREATE INDEX "SyncJob_status_idx" ON "public"."SyncJob"("status");

-- CreateIndex
CREATE INDEX "SyncJob_startedAt_idx" ON "public"."SyncJob"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "public"."User"("tenantId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "public"."User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "WindowsComplianceRule_tenantId_isActive_idx" ON "public"."WindowsComplianceRule"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Application_name_vendor_key" ON "public"."Application"("name", "vendor");

-- AddForeignKey
ALTER TABLE "public"."Client" ADD CONSTRAINT "Client_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Endpoint" ADD CONSTRAINT "Endpoint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Endpoint" ADD CONSTRAINT "Endpoint_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EndpointSource" ADD CONSTRAINT "EndpointSource_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "public"."Endpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EndpointVulnerability" ADD CONSTRAINT "EndpointVulnerability_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "public"."Endpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EndpointVulnerability" ADD CONSTRAINT "EndpointVulnerability_vulnerabilityId_fkey" FOREIGN KEY ("vulnerabilityId") REFERENCES "public"."Vulnerability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ComplianceCheck" ADD CONSTRAINT "ComplianceCheck_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "public"."Endpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ComplianceCheck" ADD CONSTRAINT "ComplianceCheck_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "public"."ComplianceFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SyncJob" ADD CONSTRAINT "SyncJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WindowsComplianceRule" ADD CONSTRAINT "WindowsComplianceRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
