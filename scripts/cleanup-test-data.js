#!/usr/bin/env node

// scripts/cleanup-test-data.js
// Script to clean up test/dummy tenants and prepare for production SentinelOne sync

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("🧹 Cleanup Test Data Script");
  console.log("=".repeat(50));

  // Step 1: Identify test tenants
  console.log("🔍 Identifying test tenants...");

  const allTenants = await db.tenant.findMany({
    include: {
      _count: {
        select: {
          users: true,
          clients: true,
          endpoints: true,
        },
      },
    },
  });

  // Identify test tenants (created by seed script)
  const testTenants = allTenants.filter(
    (tenant) =>
      tenant.slug.includes("acme") ||
      tenant.slug.includes("tech-solutions") ||
      tenant.slug.includes("global-enterprises") ||
      tenant.name.includes("Acme Corporation") ||
      tenant.name.includes("Tech Solutions Inc") ||
      tenant.name.includes("Global Enterprises LLC"),
  );

  // Identify SentinelOne-linked tenants (real ones)
  const sentinelOneTenants = allTenants.filter(
    (tenant) => tenant.sentinelOneSiteId,
  );

  // Other tenants (manual or other sources)
  const otherTenants = allTenants.filter(
    (tenant) =>
      !testTenants.some((test) => test.id === tenant.id) &&
      !sentinelOneTenants.some((s1) => s1.id === tenant.id),
  );

  console.log("\n📊 Tenant Analysis:");
  console.log(`   Total tenants: ${allTenants.length}`);
  console.log(`   Test tenants (from seed): ${testTenants.length}`);
  console.log(`   SentinelOne tenants (real): ${sentinelOneTenants.length}`);
  console.log(`   Other tenants: ${otherTenants.length}`);

  if (testTenants.length > 0) {
    console.log("\n🧪 Test tenants found:");
    testTenants.forEach((tenant) => {
      console.log(`   • ${tenant.name} (${tenant.slug})`);
      console.log(
        `     Users: ${tenant._count.users}, Clients: ${tenant._count.clients}, Endpoints: ${tenant._count.endpoints}`,
      );
    });
  }

  if (sentinelOneTenants.length > 0) {
    console.log("\n🔗 SentinelOne-linked tenants (will be preserved):");
    sentinelOneTenants.forEach((tenant) => {
      console.log(`   • ${tenant.name} (${tenant.slug})`);
      console.log(`     Site ID: ${tenant.sentinelOneSiteId}`);
      console.log(
        `     Users: ${tenant._count.users}, Clients: ${tenant._count.clients}, Endpoints: ${tenant._count.endpoints}`,
      );
    });
  }

  if (otherTenants.length > 0) {
    console.log("\n📋 Other tenants (will be preserved):");
    otherTenants.forEach((tenant) => {
      console.log(`   • ${tenant.name} (${tenant.slug})`);
      console.log(
        `     Users: ${tenant._count.users}, Clients: ${tenant._count.clients}, Endpoints: ${tenant._count.endpoints}`,
      );
    });
  }

  // Check if there are any test tenants to delete
  if (testTenants.length === 0) {
    console.log("\n✅ No test tenants found. Database is clean!");

    if (sentinelOneTenants.length > 0) {
      console.log("\n🎯 Ready for full SentinelOne sync!");
      console.log("   Your SentinelOne tenants are set up and ready.");
      console.log("   Run the full sync to get all your endpoints:");
      console.log("   1. Go to Admin Dashboard");
      console.log("   2. Use the SentinelOne sync buttons");
      console.log("   3. Or run: npm run sync-all-endpoints");
    } else {
      console.log("\n⚠️  No SentinelOne tenants found.");
      console.log("   You may need to run the SentinelOne tenant sync first:");
      console.log(
        "   1. Check your SENTINELONE_ENDPOINT and SENTINELONE_API_KEY",
      );
      console.log("   2. Run: npm run test-s1");
      console.log("   3. Then sync tenants from admin dashboard");
    }

    process.exit(0);
  }

  // Ask for confirmation before deleting
  console.log("\n⚠️  WARNING: This will DELETE the following test tenants:");
  testTenants.forEach((tenant) => {
    console.log(`   🗑️  ${tenant.name} (${tenant.slug})`);
    console.log(`      - ${tenant._count.users} users`);
    console.log(`      - ${tenant._count.clients} clients`);
    console.log(`      - ${tenant._count.endpoints} endpoints`);
    console.log(`      - All related data will be permanently deleted`);
  });

  // Interactive confirmation
  const shouldDelete = process.argv.includes("--force");

  if (!shouldDelete) {
    console.log("\n🤔 To delete these test tenants, run:");
    console.log("   node scripts/cleanup-test-data.js --force");
    console.log("\n💡 This will:");
    console.log("   ✅ Keep all SentinelOne-linked tenants");
    console.log("   ✅ Keep any manually created tenants");
    console.log("   🗑️  Delete only the test seed data");
    console.log("   🔄 Prepare for full production sync");

    process.exit(0);
  }

  // Delete test tenants
  console.log("\n🗑️  Deleting test tenants...");

  let deletedCount = 0;
  for (const tenant of testTenants) {
    try {
      console.log(`   Deleting: ${tenant.name}...`);

      // Delete tenant (cascade will handle all related data)
      await db.tenant.delete({
        where: { id: tenant.id },
      });

      console.log(`   ✅ Deleted: ${tenant.name}`);
      deletedCount++;
    } catch (error) {
      console.error(`   ❌ Failed to delete ${tenant.name}:`, error.message);
    }
  }

  console.log(`\n🎉 Cleanup complete! Deleted ${deletedCount} test tenants.`);

  // Show final status
  const remainingTenants = await db.tenant.findMany({
    include: {
      _count: {
        select: {
          endpoints: true,
        },
      },
    },
  });

  console.log("\n📊 Final Status:");
  console.log(`   Remaining tenants: ${remainingTenants.length}`);

  const sentinelOneRemaining = remainingTenants.filter(
    (t) => t.sentinelOneSiteId,
  );
  if (sentinelOneRemaining.length > 0) {
    console.log(`   SentinelOne-linked: ${sentinelOneRemaining.length}`);
    const totalEndpoints = sentinelOneRemaining.reduce(
      (sum, t) => sum + t._count.endpoints,
      0,
    );
    console.log(`   Total endpoints: ${totalEndpoints}`);

    console.log("\n🚀 Next Steps:");
    console.log("1. Your SentinelOne tenants are preserved and ready");
    console.log("2. Run a full sync to get ALL your endpoints:");
    console.log("   • Admin Dashboard → SentinelOne → Full Sync");
    console.log("   • Or API call to syncAgents endpoint");
    console.log("3. Monitor the sync jobs in the admin dashboard");

    if (totalEndpoints > 0) {
      console.log(
        `\n📈 Current Status: ${totalEndpoints} endpoints already synced`,
      );
      console.log(
        "   The full sync will update existing and add any new endpoints",
      );
    }
  } else {
    console.log("\n⚠️  No SentinelOne tenants remaining.");
    console.log("   You may need to run the tenant sync first:");
    console.log("   1. Check SENTINELONE_ENDPOINT and SENTINELONE_API_KEY");
    console.log("   2. Test connection: npm run test-s1");
    console.log("   3. Sync tenants from SentinelOne sites");
  }
}

main()
  .catch((e) => {
    console.error("💥 Cleanup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
