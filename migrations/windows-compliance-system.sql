-- Windows Compliance System Database Schema
-- Run with: npx prisma db execute --file migrations/windows-compliance-system.sql --schema prisma/schema.prisma

-- 1. Windows Version Registry (from endoflife.date)
CREATE TABLE IF NOT EXISTS "WindowsVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycle" TEXT NOT NULL, -- e.g., "11-24h2-e", "10-22h2"
    "releaseLabel" TEXT NOT NULL, -- e.g., "11 24H2 (E)", "10 22H2"
    "majorVersion" TEXT NOT NULL, -- e.g., "11", "10"
    "featureUpdate" TEXT NOT NULL, -- e.g., "24H2", "23H2", "22H2"
    "edition" TEXT, -- e.g., "Enterprise", "Home", "Pro" (E/W/etc)
    "releaseDate" DATE NOT NULL,
    "eolDate" DATE NOT NULL,
    "supportDate" DATE NOT NULL,
    "latestBuild" TEXT NOT NULL, -- e.g., "10.0.26100", "10.0.22631"
    "isSupported" BOOLEAN NOT NULL DEFAULT true,
    "isLTS" BOOLEAN NOT NULL DEFAULT false,
    "microsoftLink" TEXT,
    "lastUpdated" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tenant-specific Windows Compliance Policies
CREATE TABLE IF NOT EXISTS "WindowsCompliancePolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    
    -- Core Policy Rules
    "requireSupported" BOOLEAN NOT NULL DEFAULT true, -- Must be supported by Microsoft
    "requireLatestBuild" BOOLEAN NOT NULL DEFAULT true, -- Must have latest build for version
    "allowedVersions" TEXT[], -- Array of allowed Windows versions ["11", "10"]
    "minimumVersions" JSONB, -- {"11": "23H2", "10": "22H2"} - minimum feature updates
    "blockedVersions" TEXT[], -- Explicitly blocked versions
    
    -- Edition Rules
    "allowedEditions" TEXT[], -- ["Enterprise", "Pro", "Education"]
    "blockedEditions" TEXT[], -- ["Home"]
    
    -- Build Age Rules
    "maxBuildAgeDays" INTEGER, -- Maximum days behind latest build (NULL = no limit)
    "requireGABuilds" BOOLEAN NOT NULL DEFAULT true, -- Only GA builds, no preview
    
    -- LTS Rules  
    "allowLTSVersions" BOOLEAN NOT NULL DEFAULT true,
    "preferLTSVersions" BOOLEAN NOT NULL DEFAULT false,
    
    -- Compliance Scoring
    "complianceScoreWeights" JSONB, -- Custom scoring weights
    "failureActions" TEXT[], -- Actions when non-compliant
    
    -- Policy Metadata
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "effectiveDate" TIMESTAMP,
    "lastModified" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedBy" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

-- 3. Windows Compliance Evaluations (audit trail)
CREATE TABLE IF NOT EXISTS "WindowsComplianceEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpointId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Endpoint Windows Info at time of evaluation
    "detectedVersion" TEXT, -- e.g., "11"
    "detectedFeatureUpdate" TEXT, -- e.g., "24H2"
    "detectedEdition" TEXT, -- e.g., "Enterprise"
    "detectedBuild" TEXT, -- e.g., "10.0.26100.2152"
    "osName" TEXT, -- Raw OS name from agent
    "osRevision" TEXT, -- Raw OS revision from agent
    
    -- Compliance Results
    "isCompliant" BOOLEAN NOT NULL,
    "complianceScore" INTEGER NOT NULL, -- 0-100
    "failureReasons" TEXT[], -- Array of failure reasons
    "requiredActions" TEXT[], -- What needs to be done
    
    -- Version Analysis
    "isSupportedVersion" BOOLEAN,
    "isLatestBuild" BOOLEAN,
    "isAllowedVersion" BOOLEAN,
    "isAllowedEdition" BOOLEAN,
    "buildAgeDays" INTEGER,
    "recommendedVersion" TEXT,
    "recommendedBuild" TEXT,
    
    -- Policy Context
    "policySnapshot" JSONB, -- Snapshot of policy at evaluation time
    
    FOREIGN KEY ("endpointId") REFERENCES "Endpoint"("id") ON DELETE CASCADE,
    FOREIGN KEY ("policyId") REFERENCES "WindowsCompliancePolicy"("id") ON DELETE CASCADE
);

-- 4. Windows Build Registry (detailed build tracking)
CREATE TABLE IF NOT EXISTS "WindowsBuild" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL, -- References WindowsVersion
    "buildNumber" TEXT NOT NULL, -- e.g., "26100.2152"
    "majorBuild" TEXT NOT NULL, -- e.g., "10.0.26100"
    "minorBuild" TEXT, -- e.g., "2152"
    "buildDate" DATE,
    "isGA" BOOLEAN NOT NULL DEFAULT true, -- General Availability
    "isPreview" BOOLEAN NOT NULL DEFAULT false,
    "kbNumber" TEXT, -- KB article number
    "releaseNotes" TEXT,
    "securityFixes" INTEGER DEFAULT 0,
    "bugFixes" INTEGER DEFAULT 0,
    "isLatest" BOOLEAN NOT NULL DEFAULT false, -- Latest for this version
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY ("versionId") REFERENCES "WindowsVersion"("id") ON DELETE CASCADE
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS "WindowsVersion_majorVersion_idx" ON "WindowsVersion"("majorVersion");
CREATE INDEX IF NOT EXISTS "WindowsVersion_featureUpdate_idx" ON "WindowsVersion"("featureUpdate");
CREATE INDEX IF NOT EXISTS "WindowsVersion_latestBuild_idx" ON "WindowsVersion"("latestBuild");
CREATE INDEX IF NOT EXISTS "WindowsVersion_isSupported_idx" ON "WindowsVersion"("isSupported");
CREATE INDEX IF NOT EXISTS "WindowsVersion_eolDate_idx" ON "WindowsVersion"("eolDate");

CREATE INDEX IF NOT EXISTS "WindowsCompliancePolicy_tenantId_idx" ON "WindowsCompliancePolicy"("tenantId");
CREATE INDEX IF NOT EXISTS "WindowsCompliancePolicy_isActive_idx" ON "WindowsCompliancePolicy"("isActive");

CREATE INDEX IF NOT EXISTS "WindowsComplianceEvaluation_endpointId_idx" ON "WindowsComplianceEvaluation"("endpointId");
CREATE INDEX IF NOT EXISTS "WindowsComplianceEvaluation_evaluatedAt_idx" ON "WindowsComplianceEvaluation"("evaluatedAt");
CREATE INDEX IF NOT EXISTS "WindowsComplianceEvaluation_isCompliant_idx" ON "WindowsComplianceEvaluation"("isCompliant");

CREATE INDEX IF NOT EXISTS "WindowsBuild_versionId_idx" ON "WindowsBuild"("versionId");
CREATE INDEX IF NOT EXISTS "WindowsBuild_majorBuild_idx" ON "WindowsBuild"("majorBuild");
CREATE INDEX IF NOT EXISTS "WindowsBuild_isLatest_idx" ON "WindowsBuild"("isLatest");
CREATE INDEX IF NOT EXISTS "WindowsBuild_isGA_idx" ON "WindowsBuild"("isGA");

-- 6. Create materialized view for current compliance status
CREATE MATERIALIZED VIEW IF NOT EXISTS windows_compliance_current AS
SELECT 
    e."id" as endpoint_id,
    e."hostname",
    e."tenantId",
    t."name" as tenant_name,
    
    -- Current endpoint info
    e."osName",
    e."osVersion",
    e."osRevision",
    
    -- Latest evaluation
    eval."evaluatedAt" as last_evaluation,
    eval."isCompliant",
    eval."complianceScore",
    eval."detectedVersion",
    eval."detectedFeatureUpdate", 
    eval."detectedBuild",
    eval."failureReasons",
    eval."requiredActions",
    
    -- Recommended updates
    eval."recommendedVersion",
    eval."recommendedBuild",
    eval."buildAgeDays",
    
    -- Policy info
    policy."name" as policy_name,
    policy."requireLatestBuild",
    policy."maxBuildAgeDays"
    
FROM "Endpoint" e
LEFT JOIN "Tenant" t ON e."tenantId" = t."id"
LEFT JOIN LATERAL (
    SELECT * FROM "WindowsComplianceEvaluation" 
    WHERE "endpointId" = e."id" 
    ORDER BY "evaluatedAt" DESC 
    LIMIT 1
) eval ON true
LEFT JOIN "WindowsCompliancePolicy" policy ON eval."policyId" = policy."id"
WHERE LOWER(e."osName") LIKE '%windows%';

CREATE UNIQUE INDEX IF NOT EXISTS windows_compliance_current_endpoint_idx 
ON windows_compliance_current(endpoint_id);

-- 7. Populate initial Windows versions from endoflife.date data
-- This will be replaced by the sync service, but provides initial data
INSERT INTO "WindowsVersion" ("id", "cycle", "releaseLabel", "majorVersion", "featureUpdate", "edition", "releaseDate", "eolDate", "supportDate", "latestBuild", "isSupported", "isLTS", "microsoftLink")
VALUES 
    ('win11-24h2-e', '11-24h2-e', '11 24H2 (E)', '11', '24H2', 'Enterprise', '2024-10-01', '2027-10-12', '2027-10-12', '10.0.26100', true, false, 'https://learn.microsoft.com/windows/release-health/windows11-release-information'),
    ('win11-24h2-w', '11-24h2-w', '11 24H2 (W)', '11', '24H2', 'Home/Pro', '2024-10-01', '2026-10-13', '2026-10-13', '10.0.26100', true, false, 'https://learn.microsoft.com/windows/release-health/windows11-release-information'),
    ('win11-23h2-e', '11-23h2-e', '11 23H2 (E)', '11', '23H2', 'Enterprise', '2023-10-31', '2026-11-10', '2026-11-10', '10.0.22631', true, false, 'https://learn.microsoft.com/windows/release-health/windows11-release-information'),
    ('win11-23h2-w', '11-23h2-w', '11 23H2 (W)', '11', '23H2', 'Home/Pro', '2023-10-31', '2025-11-11', '2025-11-11', '10.0.22631', true, false, 'https://learn.microsoft.com/windows/release-health/windows11-release-information'),
    ('win11-22h2-e', '11-22h2-e', '11 22H2 (E)', '11', '22H2', 'Enterprise', '2022-09-20', '2025-10-14', '2025-10-14', '10.0.22621', true, false, 'https://learn.microsoft.com/windows/release-health/windows11-release-information'),
    ('win10-22h2', '10-22h2', '10 22H2', '10', '22H2', 'All', '2022-10-18', '2025-10-14', '2025-10-14', '10.0.19045', true, false, 'https://learn.microsoft.com/windows/release-health/release-information')
ON CONFLICT ("id") DO UPDATE SET
    "latestBuild" = EXCLUDED."latestBuild",
    "eolDate" = EXCLUDED."eolDate",
    "supportDate" = EXCLUDED."supportDate",
    "lastUpdated" = CURRENT_TIMESTAMP;

-- 8. Create default compliance policies for existing tenants
INSERT INTO "WindowsCompliancePolicy" ("id", "tenantId", "name", "description", "allowedVersions", "minimumVersions", "allowedEditions")
SELECT 
    CONCAT(t."id", '-default-windows-policy'),
    t."id",
    'Default Windows Compliance Policy',
    'Standard Windows compliance requirements: supported versions with latest builds',
    ARRAY['11', '10'],
    '{"11": "23H2", "10": "22H2"}'::jsonb,
    ARRAY['Enterprise', 'Pro', 'Education']
FROM "Tenant" t
WHERE NOT EXISTS (
    SELECT 1 FROM "WindowsCompliancePolicy" 
    WHERE "tenantId" = t."id" AND "name" = 'Default Windows Compliance Policy'
);

-- 9. Add comments
COMMENT ON TABLE "WindowsVersion" IS 'Windows versions and builds from endoflife.date API';
COMMENT ON TABLE "WindowsCompliancePolicy" IS 'Tenant-specific Windows compliance policies';
COMMENT ON TABLE "WindowsComplianceEvaluation" IS 'Audit trail of Windows compliance evaluations';
COMMENT ON TABLE "WindowsBuild" IS 'Detailed Windows build tracking';
COMMENT ON MATERIALIZED VIEW windows_compliance_current IS 'Current Windows compliance status for all endpoints';

-- 10. Refresh the materialized view
SELECT 1; -- Placeholder since we need evaluations first