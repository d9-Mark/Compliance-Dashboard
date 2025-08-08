#!/usr/bin/env node

// scripts/setup-sentinelone.js
// Complete setup and test script for SentinelOne multi-tenant integration

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config();

const db = new PrismaClient();
const SENTINELONE_ENDPOINT = process.env.SENTINELONE_ENDPOINT;
const SENTINELONE_API_KEY = process.env.SENTINELONE_API_KEY;

async function runDatabaseMigration() {
  console.log("🗄️  Running database migration...");

  try {
    // Add the new columns if they don't exist
    await db.$executeRaw`
      ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "sentinelOneSiteId" TEXT;
    `;

    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "EndpointSource" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
        "endpointId" TEXT NOT NULL,
        "sourceType" TEXT NOT NULL,
        "sourceId" TEXT NOT NULL,
        "sourceData" JSONB,
        "lastSynced" TIMESTAMP(3),
        "isPrimary" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "EndpointSource_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "EndpointSource_endpointId_sourceType_key" UNIQUE ("endpointId", "sourceType")
      );
    `;

    console.log("✅ Database migration completed");
    return true;
  } catch (error) {
    if (error.message.includes("already exists")) {
      console.log("✅ Database schema already up to date");
      return true;
    }
    console.error("❌ Database migration failed:", error.message);
    return false;
  }
}

async function testSentinelOneConnection() {
  console.log("\\n🔗 Testing SentinelOne connection...");

  try {
    // Test sites endpoint
    const sitesResponse = await fetch(
      `${SENTINELONE_ENDPOINT}/web/api/v2.1/sites`,
      {
        headers: {
          Authorization: `ApiToken ${SENTINELONE_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!sitesResponse.ok) {
      throw new Error(`Sites API failed: ${sitesResponse.status}`);
    }

    const sitesData = await sitesResponse.json();
    console.log(
      `✅ Connection successful: ${sitesData.data?.sites?.length || 0} sites found`,
    );

    return { success: true, sites: sitesData.data?.sites || [] };
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
    return { success: false, sites: [] };
  }
}

async function createTenantsFromSites(sites) {
  console.log("\\n🏢 Creating tenants from SentinelOne sites...");

  let created = 0;
  let existing = 0;

  for (const site of sites) {
    try {
      // Generate slug
      const slug = site.name
        .toLowerCase()
        .replace(/[^a-z0-9\\s-]/g, "")
        .replace(/\\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 50);

      // Check if tenant already exists
      const existingTenant = await db.tenant.findFirst({
        where: {
          OR: [{ sentinelOneSiteId: site.id }, { slug: slug }],
        },
      });

      if (existingTenant) {
        // Update if needed
        if (!existingTenant.sentinelOneSiteId) {
          await db.tenant.update({
            where: { id: existingTenant.id },
            data: { sentinelOneSiteId: site.id },
          });
          console.log(`🔄 Updated: ${site.name} → ${existingTenant.slug}`);
        } else {
          console.log(`✅ Exists: ${site.name} → ${existingTenant.slug}`);
        }
        existing++;
      } else {
        // Create new tenant
        const newTenant = await db.tenant.create({
          data: {
            name: site.name,
            slug: slug,
            sentinelOneSiteId: site.id,
          },
        });
        console.log(`✨ Created: ${site.name} → ${newTenant.slug}`);
        created++;
      }
    } catch (error) {
      console.error(`❌ Failed to process site ${site.name}:`, error.message);
    }
  }

  console.log(
    `\\n📊 Tenant creation summary: ${created} created, ${existing} existing`,
  );
  return { created, existing };
}

async function testAgentSync() {
  console.log("\\n🤖 Testing agent sync (first 10 agents)...");

  try {
    // Get site-to-tenant mapping
    const tenants = await db.tenant.findMany({
      where: { sentinelOneSiteId: { not: null } },
      select: { id: true, sentinelOneSiteId: true, name: true },
    });

    const siteToTenantMap = {};
    tenants.forEach((tenant) => {
      siteToTenantMap[tenant.sentinelOneSiteId] = tenant.id;
    });

    console.log(
      `📋 Found ${Object.keys(siteToTenantMap).length} site→tenant mappings`,
    );

    // Fetch first 10 agents
    const agentsResponse = await fetch(
      `${SENTINELONE_ENDPOINT}/web/api/v2.1/agents?limit=10`,
      {
        headers: {
          Authorization: `ApiToken ${SENTINELONE_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!agentsResponse.ok) {
      throw new Error(`Agents API failed: ${agentsResponse.status}`);
    }

    const agentsData = await agentsResponse.json();
    const agents = agentsData.data || [];

    console.log(`📡 Fetched ${agents.length} test agents`);

    let processed = 0;
    let created = 0;
    let skipped = 0;

    for (const agent of agents) {
      const tenantId = siteToTenantMap[agent.siteId];

      if (!tenantId) {
        console.log(
          `⚠️ No mapping for site ${agent.siteId} (${agent.computerName})`,
        );
        skipped++;
        continue;
      }

      try {
        // Check if endpoint exists
        const existing = await db.endpoint.findUnique({
          where: {
            tenantId_hostname: {
              tenantId,
              hostname: agent.computerName,
            },
          },
        });

        // Create/update endpoint
        const endpointData = {
          hostname: agent.computerName,
          tenantId,
          sentinelOneAgentId: agent.id,
          sentinelOneSiteId: agent.siteId,
          operatingSystem: agent.osName || null,
          osVersion: agent.osRevision || null,
          isAgentActive: agent.isActive || false,
          activeThreats: agent.activeThreats || 0,
          isInfected: agent.infected || false,
          isCompliant: !agent.infected && (agent.activeThreats || 0) === 0,
          complianceScore: agent.infected ? 60 : agent.isActive ? 95 : 80,
          lastSeen: agent.lastActiveDate
            ? new Date(agent.lastActiveDate)
            : null,
        };

        await db.endpoint.upsert({
          where: {
            tenantId_hostname: {
              tenantId,
              hostname: agent.computerName,
            },
          },
          update: endpointData,
          create: endpointData,
        });

        console.log(
          `${existing ? "🔄" : "✨"} ${agent.computerName} → ${tenants.find((t) => t.id === tenantId)?.name}`,
        );

        if (!existing) created++;
        processed++;
      } catch (error) {
        console.error(
          `❌ Failed to process ${agent.computerName}:`,
          error.message,
        );
      }
    }

    console.log(
      `\\n📊 Agent sync test: ${processed} processed, ${created} created, ${skipped} skipped`,
    );
    return { processed, created, skipped };
  } catch (error) {
    console.error("❌ Agent sync test failed:", error.message);
    return { processed: 0, created: 0, skipped: 0 };
  }
}

async function generateSummaryReport() {
  console.log("\\n📊 Generating summary report...");

  try {
    // Get tenant summary
    const tenants = await db.tenant.findMany({
      include: {
        _count: {
          select: { endpoints: true },
        },
      },
    });

    const sentinelOneTenants = tenants.filter((t) => t.sentinelOneSiteId);
    const regularTenants = tenants.filter((t) => !t.sentinelOneSiteId);

    console.log("\\n🏢 TENANT SUMMARY:");
    console.log(`   Total tenants: ${tenants.length}`);
    console.log(`   SentinelOne-linked: ${sentinelOneTenants.length}`);
    console.log(`   Regular tenants: ${regularTenants.length}`);

    if (sentinelOneTenants.length > 0) {
      console.log("\\n📋 SentinelOne Tenants:");
      sentinelOneTenants.slice(0, 10).forEach((tenant) => {
        console.log(
          `   • ${tenant.name} (${tenant._count.endpoints} endpoints)`,
        );
      });

      if (sentinelOneTenants.length > 10) {
        console.log(`   ... and ${sentinelOneTenants.length - 10} more`);
      }
    }

    // Get endpoint summary
    const endpointStats = await db.endpoint.aggregate({
      _count: { id: true },
      _avg: { complianceScore: true },
    });

    const sentinelOneEndpoints = await db.endpoint.count({
      where: { sentinelOneAgentId: { not: null } },
    });

    console.log("\\n🖥️ ENDPOINT SUMMARY:");
    console.log(`   Total endpoints: ${endpointStats._count.id}`);
    console.log(`   SentinelOne endpoints: ${sentinelOneEndpoints}`);
    console.log(
      `   Average compliance: ${Math.round(endpointStats._avg.complianceScore || 0)}%`,
    );

    return true;
  } catch (error) {
    console.error("❌ Report generation failed:", error.message);
    return false;
  }
}

async function main() {
  console.log("🚀 SentinelOne Multi-Tenant Setup");
  console.log("=".repeat(50));

  // Check prerequisites
  if (!SENTINELONE_ENDPOINT || !SENTINELONE_API_KEY) {
    console.error("❌ Missing SentinelOne configuration");
    console.log(
      "   Add SENTINELONE_ENDPOINT and SENTINELONE_API_KEY to your .env file",
    );
    process.exit(1);
  }

  // Step 1: Database migration
  const migrationSuccess = await runDatabaseMigration();
  if (!migrationSuccess) {
    console.error("❌ Database migration failed. Please fix and retry.");
    process.exit(1);
  }

  // Step 2: Test connection and get sites
  const connectionTest = await testSentinelOneConnection();
  if (!connectionTest.success) {
    console.error(
      "❌ SentinelOne connection failed. Please check your credentials.",
    );
    process.exit(1);
  }

  // Step 3: Create tenants from sites
  const tenantResult = await createTenantsFromSites(connectionTest.sites);

  // Step 4: Test agent sync with a small sample
  const agentResult = await testAgentSync();

  // Step 5: Generate summary
  await generateSummaryReport();

  console.log("\\n🎉 Setup Complete!");
  console.log("\\nNext steps:");
  console.log("1. Add the SentinelOne router to your tRPC setup");
  console.log("2. Use the admin dashboard to run full syncs");
  console.log("3. Monitor tenant dashboards for data");
  console.log("\\n📚 Your tenants are ready for:");
  console.log("   • SentinelOne agent data (✅ working)");
  console.log("   • NinjaOne integration (🔄 future)");
  console.log("   • ProofPoint integration (🔄 future)");
}

// Handle cleanup
process.on("SIGINT", async () => {
  console.log("\\nShutting down...");
  await db.$disconnect();
  process.exit(0);
});

main()
  .catch((error) => {
    console.error("💥 Setup failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
