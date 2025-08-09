#!/usr/bin/env node

// scripts/diagnose-sites-tenants.js
// Diagnostic tool to compare SentinelOne sites vs database tenants

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config();

const db = new PrismaClient();
const SENTINELONE_ENDPOINT = process.env.SENTINELONE_ENDPOINT;
const SENTINELONE_API_KEY = process.env.SENTINELONE_API_KEY;

async function diagnoseSitesTenants() {
  console.log("🔍 Site-Tenant Mapping Diagnostic");
  console.log("=".repeat(60));

  // 1. Get ALL sites from SentinelOne (WITH PAGINATION!)
  console.log("📡 Fetching ALL sites from SentinelOne with pagination...");

  let sentinelOneSites = [];
  try {
    let nextCursor = null;
    let pageCount = 0;

    do {
      pageCount++;
      console.log(`  📄 Fetching sites page ${pageCount}...`);

      const queryParams = new URLSearchParams();
      if (nextCursor) {
        queryParams.set("cursor", nextCursor);
      }
      queryParams.set("limit", "100");

      const response = await fetch(
        `${SENTINELONE_ENDPOINT}/web/api/v2.1/sites?${queryParams}`,
        {
          headers: {
            Authorization: `ApiToken ${SENTINELONE_API_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `Sites API failed: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      const sites = data.data?.sites || [];

      sentinelOneSites.push(...sites);
      nextCursor = data.pagination?.nextCursor || null;

      console.log(
        `    ✅ Page ${pageCount}: ${sites.length} sites (Total: ${sentinelOneSites.length})`,
      );

      if (pageCount > 10) {
        // Safety limit
        console.warn(`⚠️ Stopped after 10 pages for safety`);
        break;
      }
    } while (nextCursor);

    console.log(
      `✅ Found ${sentinelOneSites.length} sites total in SentinelOne`,
    );
  } catch (error) {
    console.error("❌ Failed to fetch sites:", error.message);
    process.exit(1);
  }

  // 2. Get all tenants from database
  console.log("\n📊 Fetching tenants from database...");

  const allTenants = await db.tenant.findMany({
    include: {
      _count: {
        select: { endpoints: true },
      },
    },
  });

  const sentinelOneTenants = allTenants.filter((t) => t.sentinelOneSiteId);
  console.log(
    `✅ Found ${allTenants.length} total tenants (${sentinelOneTenants.length} SentinelOne-linked)`,
  );

  // 3. Create mapping analysis
  console.log("\n🔍 SITE-TENANT MAPPING ANALYSIS:");
  console.log("=".repeat(60));

  const siteIdToTenant = {};
  sentinelOneTenants.forEach((tenant) => {
    if (tenant.sentinelOneSiteId) {
      siteIdToTenant[tenant.sentinelOneSiteId] = tenant;
    }
  });

  // Sites WITH tenants
  const mappedSites = sentinelOneSites.filter(
    (site) => siteIdToTenant[site.id],
  );
  console.log(`\n✅ SITES WITH TENANTS (${mappedSites.length}):`);
  mappedSites.forEach((site) => {
    const tenant = siteIdToTenant[site.id];
    console.log(`   • ${site.name} (${site.id})`);
    console.log(`     → Tenant: ${tenant.name} (${tenant.slug})`);
    console.log(`     → Endpoints: ${tenant._count.endpoints}`);
  });

  // Sites WITHOUT tenants (THE PROBLEM!)
  const unmappedSites = sentinelOneSites.filter(
    (site) => !siteIdToTenant[site.id],
  );
  if (unmappedSites.length > 0) {
    console.log(
      `\n❌ SITES WITHOUT TENANTS (${unmappedSites.length}) - THIS IS THE PROBLEM:`,
    );
    for (const site of unmappedSites) {
      console.log(`   • ${site.name} (${site.id})`);
      console.log(`     Account: ${site.accountName || "Unknown"}`);
      console.log(`     Type: ${site.siteType || "Unknown"}`);
      console.log(`     State: ${site.state || "Unknown"}`);

      // Check how many agents this site has
      try {
        const agentResponse = await fetch(
          `${SENTINELONE_ENDPOINT}/web/api/v2.1/agents?siteIds=${site.id}&limit=1`,
          {
            headers: {
              Authorization: `ApiToken ${SENTINELONE_API_KEY}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (agentResponse.ok) {
          const agentData = await agentResponse.json();
          const agentCount = agentData.pagination?.totalItems || 0;
          console.log(`     Agents: ${agentCount} (being skipped!)`);
        }
      } catch (error) {
        console.log(`     Agents: Unable to check`);
      }
      console.log();
    }
  } else {
    console.log(`\n✅ ALL SITES HAVE TENANTS!`);
  }

  // Tenants WITHOUT sites (probably test tenants)
  const tenantsWithoutSites = allTenants.filter((t) => !t.sentinelOneSiteId);
  if (tenantsWithoutSites.length > 0) {
    console.log(
      `\n🧪 TENANTS WITHOUT SITES (${tenantsWithoutSites.length}) - Probably test data:`,
    );
    tenantsWithoutSites.forEach((tenant) => {
      console.log(
        `   • ${tenant.name} (${tenant.slug}) - ${tenant._count.endpoints} endpoints`,
      );
    });
  }

  // 4. Sample unmapped agents
  console.log(`\n🔍 SAMPLE UNMAPPED AGENTS:`);
  const unmappedSiteIds = unmappedSites.map((s) => s.id);

  if (unmappedSiteIds.length > 0) {
    try {
      // Get sample agents from unmapped sites
      const sampleResponse = await fetch(
        `${SENTINELONE_ENDPOINT}/web/api/v2.1/agents?siteIds=${unmappedSiteIds.slice(0, 3).join(",")}&limit=10`,
        {
          headers: {
            Authorization: `ApiToken ${SENTINELONE_API_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (sampleResponse.ok) {
        const sampleData = await sampleResponse.json();
        const agents = sampleData.data || [];

        console.log(
          `   Found ${agents.length} sample agents from unmapped sites:`,
        );
        agents.slice(0, 5).forEach((agent) => {
          const site = unmappedSites.find((s) => s.id === agent.siteId);
          console.log(
            `   • ${agent.computerName} → Site: ${site?.name || "Unknown"} (${agent.siteId})`,
          );
        });
      }
    } catch (error) {
      console.log(`   Unable to fetch sample agents: ${error.message}`);
    }
  }

  // 5. Summary and recommendations
  console.log(`\n📊 SUMMARY:`);
  console.log(`   SentinelOne Sites: ${sentinelOneSites.length}`);
  console.log(`   Database Tenants: ${allTenants.length}`);
  console.log(`   Mapped Sites: ${mappedSites.length}`);
  console.log(`   Unmapped Sites: ${unmappedSites.length} ⚠️`);
  console.log(
    `   Agent Coverage: ${Math.round((mappedSites.length / sentinelOneSites.length) * 100)}%`,
  );

  const totalUnmappedAgents =
    unmappedSites.length > 0 ? "Unknown (but significant!)" : "0";
  console.log(`   Estimated Unmapped Agents: ${totalUnmappedAgents}`);

  console.log(`\n💡 RECOMMENDATIONS:`);

  if (unmappedSites.length > 0) {
    console.log(
      `   1. 🔧 Create missing tenants for ${unmappedSites.length} sites`,
    );
    console.log(`   2. 🚀 Re-run agent sync to process unmapped agents`);
    console.log(`   3. 📊 Check sync logs for why tenant creation failed`);

    console.log(`\n🛠️  TO FIX RIGHT NOW:`);
    console.log(`   • Run: npm run create-missing-tenants`);
    console.log(`   • Then: npm run sync-agents-only`);
    console.log(`   • This should get you from 368 to ~1363 agents`);
  } else {
    console.log(`   ✅ All sites have tenants - investigate other causes`);
  }

  console.log(`\n🔍 DETAILED SITE INFO:`);
  console.log(`=`.repeat(60));
  sentinelOneSites.forEach((site, index) => {
    const tenant = siteIdToTenant[site.id];
    const status = tenant ? "✅ MAPPED" : "❌ MISSING";

    console.log(`${index + 1}. ${site.name} (${site.id})`);
    console.log(`   Status: ${status}`);
    console.log(`   Account: ${site.accountName || "N/A"}`);
    console.log(`   Type: ${site.siteType || "N/A"}`);
    console.log(`   State: ${site.state || "N/A"}`);
    if (tenant) {
      console.log(
        `   Tenant: ${tenant.name} (${tenant._count.endpoints} endpoints)`,
      );
    }
    console.log();
  });
}

async function main() {
  try {
    await diagnoseSitesTenants();
  } catch (error) {
    console.error("💥 Diagnostic failed:", error);
  } finally {
    await db.$disconnect();
  }
}

main();
