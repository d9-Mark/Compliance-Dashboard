#!/usr/bin/env node

// scripts/create-missing-tenants.js
// Script to create tenants for SentinelOne sites that don't have them

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config();

const db = new PrismaClient();
const SENTINELONE_ENDPOINT = process.env.SENTINELONE_ENDPOINT;
const SENTINELONE_API_KEY = process.env.SENTINELONE_API_KEY;

function generateTenantSlug(siteName) {
  return siteName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, "") // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
}

async function ensureUniqueSlug(baseSlug) {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db.tenant.findUnique({
      where: { slug },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;

    if (counter > 100) {
      // Fallback to avoid infinite loop
      slug = `${baseSlug}-${Date.now()}`;
      break;
    }
  }

  return slug;
}

async function createMissingTenants() {
  console.log("🏗️  Create Missing Tenants");
  console.log("=".repeat(50));

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

  // 2. Get existing tenants
  console.log("📊 Checking existing tenants...");

  const existingTenants = await db.tenant.findMany({
    where: {
      sentinelOneSiteId: { not: null },
    },
  });

  const existingSiteIds = new Set(
    existingTenants.map((t) => t.sentinelOneSiteId),
  );
  console.log(
    `✅ Found ${existingTenants.length} existing SentinelOne tenants`,
  );

  // 3. Find missing sites
  const missingSites = sentinelOneSites.filter(
    (site) => !existingSiteIds.has(site.id),
  );

  if (missingSites.length === 0) {
    console.log("\n✅ All sites already have tenants!");
    console.log("   The issue might be elsewhere. Try:");
    console.log("   • Check if tenant sync failed silently");
    console.log("   • Verify API permissions");
    console.log("   • Run diagnostic again");
    return;
  }

  console.log(`\n🏗️  Found ${missingSites.length} sites without tenants:`);

  // Show what we'll create
  for (const site of missingSites) {
    const baseSlug = generateTenantSlug(site.name);
    console.log(`   • ${site.name} → /${baseSlug}`);
    console.log(`     Site ID: ${site.id}`);
    console.log(`     Account: ${site.accountName || "Unknown"}`);

    // Get agent count for this site
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
        console.log(
          `     Agents: ${agentCount} (will be synced after tenant creation)`,
        );
      }
    } catch (error) {
      console.log(`     Agents: Unable to check count`);
    }
    console.log();
  }

  // Ask for confirmation
  const shouldCreate = process.argv.includes("--force");

  if (!shouldCreate) {
    console.log("⚠️  Ready to create tenants. To proceed, run:");
    console.log("   node scripts/create-missing-tenants.js --force");
    console.log("\n💡 This will:");
    console.log(`   ✅ Create ${missingSites.length} new tenants`);
    console.log("   ✅ Link them to SentinelOne sites");
    console.log("   ✅ Enable agent sync for these sites");
    console.log("   ✅ Increase your agent coverage significantly");
    process.exit(0);
  }

  // 4. Create missing tenants
  console.log(`\n🏗️  Creating ${missingSites.length} missing tenants...`);

  let created = 0;
  let failed = 0;

  for (const site of missingSites) {
    try {
      console.log(`\n📝 Creating tenant for: ${site.name}`);

      const baseSlug = generateTenantSlug(site.name);
      const finalSlug = await ensureUniqueSlug(baseSlug);

      const tenant = await db.tenant.create({
        data: {
          name: site.name,
          slug: finalSlug,
          sentinelOneSiteId: site.id,
        },
      });

      console.log(`   ✅ Created: ${tenant.name} (/${tenant.slug})`);
      console.log(`   🔗 Linked to site: ${site.id}`);
      created++;
    } catch (error) {
      console.error(
        `   ❌ Failed to create tenant for ${site.name}:`,
        error.message,
      );
      failed++;
    }
  }

  // 5. Summary
  console.log(`\n🎉 Tenant Creation Complete!`);
  console.log(`   ✅ Created: ${created} tenants`);
  console.log(`   ❌ Failed: ${failed} tenants`);
  console.log(
    `   📊 Total SentinelOne tenants: ${existingTenants.length + created}`,
  );

  if (created > 0) {
    console.log(`\n🚀 Next Steps:`);
    console.log(`   1. Run agent sync to process agents from new tenants:`);
    console.log(`      • Admin Dashboard → SentinelOne → Sync All Agents`);
    console.log(`      • Or: npm run sync-agents-only`);
    console.log(
      `   2. This should increase your agent count from 368 to ~1363`,
    );
    console.log(`   3. Check coverage in admin dashboard diagnostics`);

    console.log(`\n📈 Expected Results:`);
    console.log(`   • Before: 368/1363 agents (27% coverage)`);
    console.log(`   • After: ~1363/1363 agents (95%+ coverage)`);
    console.log(`   • New tenants: ${created} additional organizations`);
  }

  // 6. Verification
  console.log(`\n🔍 Verification:`);
  const newTenantCount = await db.tenant.count({
    where: { sentinelOneSiteId: { not: null } },
  });
  console.log(`   Total SentinelOne tenants in DB: ${newTenantCount}`);
  console.log(`   Total SentinelOne sites: ${sentinelOneSites.length}`);
  console.log(
    `   Coverage: ${Math.round((newTenantCount / sentinelOneSites.length) * 100)}%`,
  );

  if (newTenantCount === sentinelOneSites.length) {
    console.log(`   ✅ Perfect! All sites now have tenants.`);
  } else {
    console.log(
      `   ⚠️  Still missing ${sentinelOneSites.length - newTenantCount} tenants.`,
    );
  }
}

async function main() {
  try {
    await createMissingTenants();
  } catch (error) {
    console.error("💥 Tenant creation failed:", error);
  } finally {
    await db.$disconnect();
  }
}

main();
