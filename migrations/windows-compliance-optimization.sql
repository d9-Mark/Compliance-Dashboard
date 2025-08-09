-- Windows Compliance Database Optimization (SIMPLE VERSION)
-- Run this with: npx prisma db execute --file migrations/windows-compliance-simple.sql --schema prisma/schema.prisma

-- 1. Add basic indexes for Windows compliance queries
CREATE INDEX IF NOT EXISTS "Endpoint_windowsCompliant_idx" ON "Endpoint"("windowsCompliant");
CREATE INDEX IF NOT EXISTS "Endpoint_windowsComplianceScore_idx" ON "Endpoint"("windowsComplianceScore");
CREATE INDEX IF NOT EXISTS "Endpoint_lastWindowsCheck_idx" ON "Endpoint"("lastWindowsCheck");

-- 2. Add composite indexes for efficient filtering (NO WHERE clauses to avoid immutable function issues)
CREATE INDEX IF NOT EXISTS "Endpoint_tenant_os_compliance_idx" 
ON "Endpoint"("tenantId", "operatingSystem", "isCompliant");

CREATE INDEX IF NOT EXISTS "Endpoint_tenant_windows_idx" 
ON "Endpoint"("tenantId", "osName", "windowsCompliant");

-- 3. Add index for Windows version analysis
CREATE INDEX IF NOT EXISTS "Endpoint_windows_version_idx" 
ON "Endpoint"("osName", "osVersion", "osRevision");

-- 4. Simple indexes without complex WHERE clauses
CREATE INDEX IF NOT EXISTS "Endpoint_non_compliant_idx" 
ON "Endpoint"("tenantId", "hostname") WHERE "windowsCompliant" = false;

CREATE INDEX IF NOT EXISTS "Endpoint_compliance_check_idx" 
ON "Endpoint"("tenantId", "lastWindowsCheck");

-- 5. Create function to calculate Windows compliance score (marked as IMMUTABLE)
CREATE OR REPLACE FUNCTION calculate_windows_compliance_score(
    os_name TEXT,
    os_version TEXT,
    last_seen TIMESTAMP
) RETURNS INTEGER 
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    score INTEGER := 100;
    days_since_seen INTEGER;
BEGIN
    -- Return early if no OS name
    IF os_name IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Deduct points for old versions (using LOWER for case insensitive)
    IF LOWER(os_name) LIKE '%windows 10%' AND (os_version ~ '19041|19042|19043' OR os_version IS NULL) THEN
        score := score - 20;
    ELSIF LOWER(os_name) LIKE '%windows 11%' AND (os_version ~ '22000' OR os_version IS NULL) THEN
        score := score - 10;
    ELSIF LOWER(os_name) LIKE '%server 2016%' OR LOWER(os_name) LIKE '%server 2019%' THEN
        score := score - 15;
    END IF;
    
    -- Deduct points for stale data (simplified calculation)
    IF last_seen IS NOT NULL THEN
        -- Calculate days difference properly
        days_since_seen := CURRENT_DATE - last_seen::date;
        IF days_since_seen > 30 THEN
            score := score - 20;
        ELSIF days_since_seen > 7 THEN
            score := score - 10;
        END IF;
    ELSE
        score := score - 30;
    END IF;
    
    RETURN GREATEST(0, LEAST(100, score));
END;
$$;

-- 6. Create trigger function to update endpoint compliance timestamps
CREATE OR REPLACE FUNCTION update_windows_compliance_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update lastWindowsCheck when windowsCompliant or windowsComplianceScore changes
    IF (OLD."windowsCompliant" IS DISTINCT FROM NEW."windowsCompliant" OR 
        OLD."windowsComplianceScore" IS DISTINCT FROM NEW."windowsComplianceScore") THEN
        NEW."lastWindowsCheck" = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$;

-- 7. Create trigger to auto-update Windows compliance timestamps
DROP TRIGGER IF EXISTS update_windows_compliance_timestamp_trigger ON "Endpoint";
CREATE TRIGGER update_windows_compliance_timestamp_trigger
    BEFORE UPDATE ON "Endpoint"
    FOR EACH ROW
    EXECUTE FUNCTION update_windows_compliance_timestamp();

-- 8. Update existing endpoints with calculated compliance scores
UPDATE "Endpoint" 
SET 
    "windowsComplianceScore" = calculate_windows_compliance_score("osName", "osVersion", "lastSeen"),
    "windowsCompliant" = CASE 
        WHEN calculate_windows_compliance_score("osName", "osVersion", "lastSeen") >= 80 THEN true
        ELSE false
    END,
    "lastWindowsCheck" = CURRENT_TIMESTAMP
WHERE LOWER(COALESCE("osName", '')) LIKE '%windows%' 
AND ("windowsComplianceScore" IS NULL OR "lastWindowsCheck" IS NULL);

-- 9. Create simple view for Windows version distribution
CREATE OR REPLACE VIEW windows_version_distribution AS
SELECT 
    t.name as tenant_name,
    t.slug as tenant_slug,
    e."osName" as os_name,
    e."osVersion" as os_version,
    COUNT(*) as endpoint_count,
    COUNT(*) FILTER (WHERE e."windowsCompliant" = true) as compliant_count,
    COUNT(*) FILTER (WHERE e."windowsCompliant" = false) as non_compliant_count,
    ROUND(AVG(e."windowsComplianceScore"), 2) as avg_score
FROM "Tenant" t
JOIN "Endpoint" e ON t.id = e."tenantId"
WHERE LOWER(COALESCE(e."osName", '')) LIKE '%windows%'
GROUP BY t.name, t.slug, e."osName", e."osVersion"
ORDER BY t.name, endpoint_count DESC;

-- 10. Add helpful comments
COMMENT ON COLUMN "Endpoint"."windowsCompliant" IS 'Indicates if the Windows version is compliant with organizational policy';
COMMENT ON COLUMN "Endpoint"."windowsComplianceScore" IS 'Compliance score from 0-100 based on Windows version, patches, and recency';
COMMENT ON COLUMN "Endpoint"."lastWindowsCheck" IS 'Timestamp of the last Windows compliance evaluation';

-- 11. Simple performance stats view
CREATE OR REPLACE VIEW compliance_performance_stats AS
SELECT 
    'endpoints_total' as metric,
    COUNT(*) as value,
    'Total endpoints in system' as description
FROM "Endpoint"
UNION ALL
SELECT 
    'endpoints_windows' as metric,
    COUNT(*) as value,
    'Windows endpoints' as description
FROM "Endpoint" WHERE LOWER(COALESCE("osName", '')) LIKE '%windows%'
UNION ALL
SELECT 
    'endpoints_windows_compliant' as metric,
    COUNT(*) as value,
    'Compliant Windows endpoints' as description
FROM "Endpoint" WHERE LOWER(COALESCE("osName", '')) LIKE '%windows%' AND "windowsCompliant" = true;