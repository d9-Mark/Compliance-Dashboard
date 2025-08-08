-- Migration: Add multi-source support
-- Run this with: npx prisma db execute --file migrations/add-multi-source.sql

-- 1. Add source tracking columns to tenants
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "sentinelOneSiteId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "ninjaOneOrganizationId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "proofpointOrganizationId" TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "Tenant_sentinelOneSiteId_idx" ON "Tenant"("sentinelOneSiteId");
CREATE INDEX IF NOT EXISTS "Tenant_ninjaOneOrganizationId_idx" ON "Tenant"("ninjaOneOrganizationId");

-- 2. Add SentinelOne site tracking to endpoints  
ALTER TABLE "Endpoint" ADD COLUMN IF NOT EXISTS "sentinelOneSiteId" TEXT;
CREATE INDEX IF NOT EXISTS "Endpoint_sentinelOneSiteId_idx" ON "Endpoint"("sentinelOneSiteId");

-- 3. Create endpoint sources tracking table
CREATE TABLE IF NOT EXISTS "EndpointSource" (
  "id" TEXT NOT NULL,
  "endpointId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceData" JSONB,
  "lastSynced" TIMESTAMP(3),
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EndpointSource_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint for endpoint + source type
CREATE UNIQUE INDEX IF NOT EXISTS "EndpointSource_endpointId_sourceType_key" 
ON "EndpointSource"("endpointId", "sourceType");

-- Add foreign key constraints
ALTER TABLE "EndpointSource" ADD CONSTRAINT "EndpointSource_endpointId_fkey" 
FOREIGN KEY ("endpointId") REFERENCES "Endpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "EndpointSource_sourceType_idx" ON "EndpointSource"("sourceType");
CREATE INDEX IF NOT EXISTS "EndpointSource_sourceId_idx" ON "EndpointSource"("sourceId");
CREATE INDEX IF NOT EXISTS "EndpointSource_isPrimary_idx" ON "EndpointSource"("isPrimary");

-- 4. Create compliance summary table for multi-source compliance
CREATE TABLE IF NOT EXISTS "EndpointComplianceSummary" (
  "endpointId" TEXT NOT NULL,
  "overallScore" INTEGER,
  "sentineloneScore" INTEGER,
  "ninjaoneScore" INTEGER,
  "proofpointScore" INTEGER,
  "criticalIssues" JSONB,
  "lastCalculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EndpointComplianceSummary_pkey" PRIMARY KEY ("endpointId")
);

-- Add foreign key constraint
ALTER TABLE "EndpointComplianceSummary" ADD CONSTRAINT "EndpointComplianceSummary_endpointId_fkey" 
FOREIGN KEY ("endpointId") REFERENCES "Endpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create function to update the updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to auto-update updatedAt
CREATE TRIGGER update_endpoint_source_updated_at 
BEFORE UPDATE ON "EndpointSource" 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_summary_updated_at 
BEFORE UPDATE ON "EndpointComplianceSummary" 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Add helpful views for reporting
CREATE OR REPLACE VIEW tenant_source_summary AS
SELECT 
  t."id" as tenant_id,
  t."name" as tenant_name,
  t."slug" as tenant_slug,
  t."sentinelOneSiteId",
  COUNT(e."id") as total_endpoints,
  COUNT(es."id") FILTER (WHERE es."sourceType" = 'SENTINELONE') as sentinelone_endpoints,
  COUNT(es."id") FILTER (WHERE es."sourceType" = 'NINJAONE') as ninjaone_endpoints,
  COUNT(es."id") FILTER (WHERE es."sourceType" = 'PROOFPOINT') as proofpoint_endpoints,
  AVG(e."complianceScore") as avg_compliance_score
FROM "Tenant" t
LEFT JOIN "Endpoint" e ON t."id" = e."tenantId"
LEFT JOIN "EndpointSource" es ON e."id" = es."endpointId"
GROUP BY t."id", t."name", t."slug", t."sentinelOneSiteId";

-- 6. Create function to generate unique tenant slugs
CREATE OR REPLACE FUNCTION generate_unique_tenant_slug(base_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 1;
BEGIN
  -- Generate base slug from name
  base_slug := lower(regexp_replace(
    regexp_replace(base_name, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  ));
  
  -- Remove leading/trailing hyphens
  base_slug := trim(both '-' from base_slug);
  
  -- Limit length
  base_slug := substring(base_slug from 1 for 50);
  
  final_slug := base_slug;
  
  -- Check for uniqueness and increment if needed
  WHILE EXISTS (SELECT 1 FROM "Tenant" WHERE "slug" = final_slug) LOOP
    final_slug := base_slug || '-' || counter;
    counter := counter + 1;
    
    -- Prevent infinite loop
    IF counter > 100 THEN
      final_slug := base_slug || '-' || extract(epoch from now())::text;
      EXIT;
    END IF;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;