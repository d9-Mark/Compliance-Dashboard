-- Windows Compliance Tables Migration
-- Run with: npx prisma db execute --file migrations/windows-compliance-tables.sql --schema prisma/schema.prisma

-- 1. Create WindowsVersion table
CREATE TABLE IF NOT EXISTS "WindowsVersion" (
    "id" TEXT NOT NULL,
    "cycle" TEXT NOT NULL,
    "releaseLabel" TEXT NOT NULL,
    "majorVersion" TEXT NOT NULL,
    "featureUpdate" TEXT NOT NULL,
    "edition" TEXT,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "eolDate" TIMESTAMP(3) NOT NULL,
    "supportDate" TIMESTAMP(3) NOT NULL,
    "latestBuild" TEXT NOT NULL,
    "isSupported" BOOLEAN NOT NULL DEFAULT true,
    "isLTS" BOOLEAN NOT NULL DEFAULT false,
    "microsoftLink" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WindowsVersion_pkey" PRIMARY KEY ("id")
);

-- 2. Create WindowsCompliancePolicy table
CREATE TABLE IF NOT EXISTS "WindowsCompliancePolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "requireSupported" BOOLEAN NOT NULL DEFAULT true,
    "requireLatestBuild" BOOLEAN NOT NULL DEFAULT true,
    "allowedVersions" TEXT[],
    "minimumVersions" JSONB,
    "blockedVersions" TEXT[],
    "allowedEditions" TEXT[],
    "blockedEditions" TEXT[],
    "maxBuildAgeDays" INTEGER,
    "requireGABuilds" BOOLEAN NOT NULL DEFAULT true,
    "allowLTSVersions" BOOLEAN NOT NULL DEFAULT true,
    "preferLTSVersions" BOOLEAN NOT NULL DEFAULT false,
    "complianceScoreWeights" JSONB,
    "failureActions" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "effectiveDate" TIMESTAMP(3),
    "lastModified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WindowsCompliancePolicy_pkey" PRIMARY KEY ("id")
);

-- 3. Create WindowsComplianceEvaluation table
CREATE TABLE IF NOT EXISTS "WindowsComplianceEvaluation" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detectedVersion" TEXT,
    "detectedFeatureUpdate" TEXT,
    "detectedEdition" TEXT,
    "detectedBuild" TEXT,
    "osName" TEXT,
    "osRevision" TEXT,
    "isCompliant" BOOLEAN NOT NULL,
    "complianceScore" INTEGER NOT NULL,
    "failureReasons" TEXT[],
    "requiredActions" TEXT[],
    "isSupportedVersion" BOOLEAN,
    "isLatestBuild" BOOLEAN,
    "isAllowedVersion" BOOLEAN,
    "isAllowedEdition" BOOLEAN,
    "buildAgeDays" INTEGER,
    "recommendedVersion" TEXT,
    "recommendedBuild" TEXT,
    "policySnapshot" JSONB,

    CONSTRAINT "WindowsComplianceEvaluation_pkey" PRIMARY KEY ("id")
);

-- 4. Create WindowsBuild table
CREATE TABLE IF NOT EXISTS "WindowsBuild" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "buildNumber" TEXT NOT NULL,
    "majorBuild" TEXT NOT NULL,
    "minorBuild" TEXT,
    "buildDate" TIMESTAMP(3),
    "isGA" BOOLEAN NOT NULL DEFAULT true,
    "isPreview" BOOLEAN NOT NULL DEFAULT false,
    "kbNumber" TEXT,
    "releaseNotes" TEXT,
    "securityFixes" INTEGER NOT NULL DEFAULT 0,
    "bugFixes" INTEGER NOT NULL DEFAULT 0,
    "isLatest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WindowsBuild_pkey" PRIMARY KEY ("id")
);

-- 5. Create indexes for performance
CREATE UNIQUE INDEX IF NOT EXISTS "WindowsVersion_cycle_key" ON "WindowsVersion"("cycle");
CREATE INDEX IF NOT EXISTS "WindowsVersion_majorVersion_idx" ON "WindowsVersion"("majorVersion");
CREATE INDEX IF NOT EXISTS "WindowsVersion_featureUpdate_idx" ON "WindowsVersion"("featureUpdate");
CREATE INDEX IF NOT EXISTS "WindowsVersion_latestBuild_idx" ON "WindowsVersion"("latestBuild");
CREATE INDEX IF NOT EXISTS "WindowsVersion_isSupported_idx" ON "WindowsVersion"("isSupported");
CREATE INDEX IF NOT EXISTS "WindowsVersion_eolDate_idx" ON "WindowsVersion"("eolDate");

CREATE INDEX IF NOT EXISTS "WindowsCompliancePolicy_tenantId_idx" ON "WindowsCompliancePolicy"("tenantId");
CREATE INDEX IF NOT EXISTS "WindowsCompliancePolicy_isActive_idx" ON "WindowsCompliancePolicy"("isActive");
CREATE INDEX IF NOT EXISTS "WindowsCompliancePolicy_priority_idx" ON "WindowsCompliancePolicy"("priority");

CREATE INDEX IF NOT EXISTS "WindowsComplianceEvaluation_endpointId_idx" ON "WindowsComplianceEvaluation"("endpointId");
CREATE INDEX IF NOT EXISTS "WindowsComplianceEvaluation_evaluatedAt_idx" ON "WindowsComplianceEvaluation"("evaluatedAt");
CREATE INDEX IF NOT EXISTS "WindowsComplianceEvaluation_isCompliant_idx" ON "WindowsComplianceEvaluation"("isCompliant");
CREATE INDEX IF NOT EXISTS "WindowsComplianceEvaluation_detectedVersion_idx" ON "WindowsComplianceEvaluation"("detectedVersion");

CREATE INDEX IF NOT EXISTS "WindowsBuild_versionId_idx" ON "WindowsBuild"("versionId");
CREATE INDEX IF NOT EXISTS "WindowsBuild_majorBuild_idx" ON "WindowsBuild"("majorBuild");
CREATE INDEX IF NOT EXISTS "WindowsBuild_isLatest_idx" ON "WindowsBuild"("isLatest");
CREATE INDEX IF NOT EXISTS "WindowsBuild_isGA_idx" ON "WindowsBuild"("isGA");

-- 6. Add foreign key constraints
ALTER TABLE "WindowsCompliancePolicy" ADD CONSTRAINT "WindowsCompliancePolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WindowsComplianceEvaluation" ADD CONSTRAINT "WindowsComplianceEvaluation_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "Endpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WindowsComplianceEvaluation" ADD CONSTRAINT "WindowsComplianceEvaluation_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "WindowsCompliancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WindowsBuild" ADD CONSTRAINT "WindowsBuild_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "WindowsVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. Insert initial Windows versions from endoflife.date data
INSERT INTO "WindowsVersion" ("id", "cycle", "releaseLabel", "majorVersion", "featureUpdate", "edition", "releaseDate", "eolDate", "supportDate", "latestBuild", "isSupported", "isLTS", "microsoftLink")
VALUES 
    ('win11-24h2-e', '11-24h2-e', '11 24H2 (E)', '11', '24H2', 'Enterprise', '2024-10-01', '2027-10-12', '2027-10-12', '10.0.26100', true, false, 'https://learn.microsoft.com/windows/release-health/windows11-release-information'),
    ('win11-24h2-w', '11-24h2-w', '11 24H2 (W)', '11', '24H2', 'Home/Pro', '2024-10-01', '2026-10-13', '2026-10-13', '10.0.26100', true, false, 'https://learn.microsoft.com/windows/release-health/windows11-release-information'),
    ('win11-23h2-e', '11-23h2-e', '11 23H2 (E)', '11', '23H2', 'Enterprise', '2023-10-31', '2026-11-10', '2026-11-10', '10.0.22631', true, false, 'https://learn.microsoft.com/windows/release-health/windows11-release-information'),
    ('win11-23h2-w', '11-23h2-w', '11 23H2 (W)', '11', '23H2', 'Home/Pro', '2023-10-31', '2025-11-11', '2025-11-11', '10.0.22631', true, false, 'https://learn.microsoft.com/windows/release-health/windows11-release-information'),
    ('win11-22h2-e', '11-22h2-e', '11 22H2 (E)', '11', '22H2', 'Enterprise', '2022-09-20', '2025-10-14', '2025-10-14', '10.0.22621', true, false, 'https://learn.microsoft.com/windows/release-health/windows11-release-information'),
    ('win11-22h2-w', '11-22h2-w', '11 22H2 (W)', '11', '22H2', 'Home/Pro', '2022-09-20', '2024-10-08', '2024-10-08', '10.0.22621', false, false, 'https://learn.microsoft.com/windows/release-health/windows11-release-information'),
    ('win10-22h2', '10-22h2', '10 22H2', '10', '22H2', 'All', '2022-10-18', '2025-10-14', '2025-10-14', '10.0.19045', true, false, 'https://learn.microsoft.com/windows/release-health/release-information'),
    ('win10-21h2-e-lts', '10-21h2-e-lts', '10 21H2 (E)', '10', '21H2', 'Enterprise', '2021-11-16', '2027-01-12', '2027-01-12', '10.0.19044', true, true, 'https://learn.microsoft.com/windows/release-health/release-information#enterprise-and-iot-enterprise-ltsbltsc-editions'),
    ('winserver2022', 'server2022-datacenter', 'Server 2022 Datacenter', 'Server2022', '2022', 'Datacenter', '2021-08-18', '2031-10-14', '2026-10-13', '10.0.20348', true, true, 'https://learn.microsoft.com/windows-server/get-started/'),
    ('winserver2019', 'server2019-datacenter', 'Server 2019 Datacenter', 'Server2019', '2019', 'Datacenter', '2018-11-13', '2029-01-09', '2024-01-09', '10.0.17763', true, false, 'https://learn.microsoft.com/windows-server/get-started-19/')
ON CONFLICT ("id") DO UPDATE SET
    "latestBuild" = EXCLUDED."latestBuild",
    "eolDate" = EXCLUDED."eolDate",
    "supportDate" = EXCLUDED."supportDate",
    "isSupported" = EXCLUDED."isSupported",
    "lastUpdated" = CURRENT_TIMESTAMP;

-- 8. Create default compliance policies for existing tenants
INSERT INTO "WindowsCompliancePolicy" ("id", "tenantId", "name", "description", "allowedVersions", "minimumVersions", "allowedEditions")
SELECT 
    CONCAT(t."id", '-default-windows-policy') as id,
    t."id" as "tenantId",
    'Default Windows Compliance Policy' as name,
    'Standard Windows compliance: supported versions with latest GA builds' as description,
    ARRAY['11', '10'] as "allowedVersions",
    '{"11": "23H2", "10": "22H2"}'::jsonb as "minimumVersions",
    ARRAY['Enterprise', 'Pro', 'Education'] as "allowedEditions"
FROM "Tenant" t
WHERE NOT EXISTS (
    SELECT 1 FROM "WindowsCompliancePolicy" 
    WHERE "tenantId" = t."id" AND "name" = 'Default Windows Compliance Policy'
);

-- 9. Insert sample Windows builds for tracking
INSERT INTO "WindowsBuild" ("id", "versionId", "buildNumber", "majorBuild", "minorBuild", "isGA", "isLatest")
VALUES 
    ('build-11-24h2-latest', 'win11-24h2-e', '26100.2152', '10.0.26100', '2152', true, true),
    ('build-11-23h2-latest', 'win11-23h2-e', '22631.4317', '10.0.22631', '4317', true, true),
    ('build-11-22h2-latest', 'win11-22h2-e', '22621.4317', '10.0.22621', '4317', true, true),
    ('build-10-22h2-latest', 'win10-22h2', '19045.5247', '10.0.19045', '5247', true, true),
    ('build-server2022-latest', 'winserver2022', '20348.2700', '10.0.20348', '2700', true, true),
    ('build-server2019-latest', 'winserver2019', '17763.6414', '10.0.17763', '6414', true, true)
ON CONFLICT ("id") DO UPDATE SET
    "buildNumber" = EXCLUDED."buildNumber",
    "minorBuild" = EXCLUDED."minorBuild",
    "isLatest" = EXCLUDED."isLatest";

-- 10. Add helpful comments
COMMENT ON TABLE "WindowsVersion" IS 'Windows versions and builds from endoflife.date API with compliance tracking';
COMMENT ON TABLE "WindowsCompliancePolicy" IS 'Tenant-specific Windows compliance policies with detailed rules';
COMMENT ON TABLE "WindowsComplianceEvaluation" IS 'Audit trail of Windows compliance evaluations with detailed analysis';
COMMENT ON TABLE "WindowsBuild" IS 'Detailed Windows build tracking with GA/Preview status';

-- 11. Create a view for current compliance status
CREATE OR REPLACE VIEW windows_compliance_overview AS
SELECT 
    t."name" as tenant_name,
    t."slug" as tenant_slug,
    COUNT(e."id") as total_windows_endpoints,
    COUNT(eval."id") as evaluated_endpoints,
    COUNT(eval."id") FILTER (WHERE eval."isCompliant" = true) as compliant_endpoints,
    COUNT(eval."id") FILTER (WHERE eval."isCompliant" = false) as non_compliant_endpoints,
    CASE 
        WHEN COUNT(eval."id") > 0 
        THEN ROUND((COUNT(eval."id") FILTER (WHERE eval."isCompliant" = true)::numeric / COUNT(eval."id")::numeric) * 100, 1)
        ELSE NULL
    END as compliance_percentage,
    MAX(eval."evaluatedAt") as last_evaluation,
    policy."name" as active_policy
FROM "Tenant" t
LEFT JOIN "Endpoint" e ON t."id" = e."tenantId" AND LOWER(e."osName") LIKE '%windows%'
LEFT JOIN "WindowsCompliancePolicy" policy ON t."id" = policy."tenantId" AND policy."isActive" = true
LEFT JOIN LATERAL (
    SELECT * FROM "WindowsComplianceEvaluation" 
    WHERE "endpointId" = e."id" 
    ORDER BY "evaluatedAt" DESC 
    LIMIT 1
) eval ON true
GROUP BY t."id", t."name", t."slug", policy."name"
ORDER BY t."name";

COMMENT ON VIEW windows_compliance_overview IS 'High-level Windows compliance overview by tenant';

-- Migration complete
SELECT 'Windows compliance tables created successfully' as result;