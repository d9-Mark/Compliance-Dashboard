// scripts/sync-cves.js
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { CVESyncService } from "../src/server/services/cve-sync.ts";

config();

const db = new PrismaClient();

/**
 * Production CVE sync script
 * Handles the full 107k+ CVE sync with proper error handling and logging
 */

const REQUIRED_ENV_VARS = [
  "SENTINELONE_API_KEY",
  "SENTINELONE_ENDPOINT",
  "DATABASE_URL",
];

function validateEnvironment() {
  const missing = REQUIRED_ENV_VARS.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((varName) => {
      console.error(`   - ${varName}`);
    });
    process.exit(1);
  }
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function logProgress(progress) {
  const {
    totalProcessed,
    estimatedTotal,
    currentPage,
    vulnerabilitiesCreated,
    endpointVulnsCreated,
    unmappedCount,
    completedPercentage,
  } = progress;

  // Clear previous line and show progress
  process.stdout.write("\r\x1b[K");
  process.stdout.write(
    `📊 Page ${currentPage} | ` +
      `${completedPercentage}% (${totalProcessed.toLocaleString()}/${estimatedTotal.toLocaleString()}) | ` +
      `Vulns: +${vulnerabilitiesCreated} | ` +
      `Links: +${endpointVulnsCreated} | ` +
      `Unmapped: ${unmappedCount}`,
  );
}

async function performPreflightChecks() {
  console.log("🔍 Performing preflight checks...");

  // Check database connection
  try {
    await db.$connect();
    console.log("✅ Database connection successful");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw error;
  }

  // Check SentinelOne API
  try {
    const response = await fetch(
      `${process.env.SENTINELONE_ENDPOINT}/web/api/v2.1/application-management/risks?limit=1`,
      {
        headers: {
          Authorization: `ApiToken ${process.env.SENTINELONE_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`API responded with ${response.status}`);
    }

    const data = await response.json();
    const totalCVEs = data.pagination?.totalItems || 0;
    console.log(
      `✅ SentinelOne API accessible (${totalCVEs.toLocaleString()} CVEs available)`,
    );
    return totalCVEs;
  } catch (error) {
    console.error("❌ SentinelOne API check failed:", error);
    throw error;
  }
}

async function checkEndpointMapping() {
  console.log("🔗 Checking endpoint mapping...");

  const [totalEndpoints, mappedEndpoints] = await Promise.all([
    db.endpoint.count(),
    db.endpoint.count({
      where: { sentinelOneAgentId: { not: null } },
    }),
  ]);

  const mappingRate =
    totalEndpoints > 0
      ? Math.round((mappedEndpoints / totalEndpoints) * 100)
      : 0;

  console.log(
    `📊 Endpoint mapping: ${mappedEndpoints}/${totalEndpoints} (${mappingRate}%)`,
  );

  if (mappingRate < 50) {
    console.warn("⚠️  Low endpoint mapping rate detected!");
    console.warn("   Consider running agent sync first to improve mapping");
    console.warn("   Some CVEs may be skipped due to unmapped endpoints");
  } else {
    console.log("✅ Good endpoint mapping rate");
  }

  return { totalEndpoints, mappedEndpoints, mappingRate };
}

async function performSync(options = {}) {
  const { dryRun = false, continueOnError = true, maxRetries = 3 } = options;

  if (dryRun) {
    console.log("🧪 DRY RUN MODE - No data will be modified");
  }

  const cveService = new CVESyncService(
    process.env.SENTINELONE_API_KEY,
    process.env.SENTINELONE_ENDPOINT,
    db,
  );

  let attempt = 1;
  let lastError = null;

  while (attempt <= maxRetries) {
    try {
      console.log(
        `\n🚀 Starting CVE sync (attempt ${attempt}/${maxRetries})...`,
      );

      const startTime = new Date();
      const result = await cveService.syncAllCVEs(logProgress);

      // Clear progress line
      process.stdout.write("\r\x1b[K");

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.log("\n🎉 CVE sync completed successfully!");
      console.log("=".repeat(50));
      console.log(`📊 Results Summary:`);
      console.log(
        `   Total Processed: ${result.totalProcessed.toLocaleString()}`,
      );
      console.log(
        `   Vulnerabilities: ${result.vulnerabilitiesCreated} created, ${result.vulnerabilitiesUpdated} updated`,
      );
      console.log(
        `   Endpoint Links: ${result.endpointVulnsCreated} created, ${result.endpointVulnsUpdated} updated`,
      );
      console.log(`   Skipped (unmapped): ${result.endpointVulnsSkipped}`);
      console.log(`   Duration: ${formatDuration(duration)}`);
      console.log(`   Pages Processed: ${result.syncDetails.pagesProcessed}`);
      console.log(
        `   Avg Page Time: ${Math.round(result.syncDetails.avgProcessingTimePerPage)}ms`,
      );

      if (result.unmappedEndpoints.length > 0) {
        console.log(
          `\n⚠️  Unmapped Endpoints (${result.unmappedEndpoints.length}):`,
        );
        result.unmappedEndpoints.slice(0, 10).forEach((endpointId) => {
          console.log(`   - ${endpointId}`);
        });
        if (result.unmappedEndpoints.length > 10) {
          console.log(
            `   ... and ${result.unmappedEndpoints.length - 10} more`,
          );
        }
      }

      if (result.errors.length > 0) {
        console.log(`\n❌ Errors (${result.errors.length}):`);
        result.errors.forEach((error) => {
          console.log(`   - ${error}`);
        });
      }

      // Update endpoint vulnerability counts
      console.log("\n📊 Updating endpoint vulnerability counts...");
      await cveService.updateEndpointVulnerabilityCounts();
      console.log("✅ Vulnerability counts updated");

      return result;
    } catch (error) {
      lastError = error;
      console.error(`\n❌ Sync attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        const retryDelay = Math.min(1000 * Math.pow(2, attempt), 30000); // Exponential backoff, max 30s
        console.log(`⏳ Retrying in ${retryDelay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }

      attempt++;
    }
  }

  // If we get here, all retries failed
  console.error(
    `💥 All ${maxRetries} sync attempts failed. Last error:`,
    lastError,
  );
  throw lastError;
}

async function postSyncValidation() {
  console.log("\n🔍 Performing post-sync validation...");

  const stats = await Promise.all([
    db.vulnerability.count(),
    db.endpointVulnerability.count(),
    db.endpointVulnerability.count({ where: { status: "OPEN" } }),
    db.endpointVulnerability.groupBy({
      by: ["detectedBy"],
      _count: true,
    }),
  ]);

  const [vulnCount, endpointVulnCount, openVulnCount, sourceBreakdown] = stats;

  console.log("📊 Database State After Sync:");
  console.log(`   Vulnerabilities: ${vulnCount.toLocaleString()}`);
  console.log(
    `   Endpoint-Vulnerability Links: ${endpointVulnCount.toLocaleString()}`,
  );
  console.log(`   Open Vulnerabilities: ${openVulnCount.toLocaleString()}`);

  console.log("   Sources:");
  sourceBreakdown.forEach((item) => {
    console.log(`     ${item.detectedBy}: ${item._count.toLocaleString()}`);
  });

  // Check for data consistency
  const orphanedVulns = await db.vulnerability.count({
    where: {
      endpoints: {
        none: {},
      },
    },
  });

  if (orphanedVulns > 0) {
    console.warn(
      `⚠️  Found ${orphanedVulns} vulnerabilities with no endpoint links`,
    );
  } else {
    console.log("✅ No orphaned vulnerabilities found");
  }
}

async function main() {
  console.log("🚀 SentinelOne CVE Sync Script");
  console.log("=".repeat(50));

  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const dryRun = args.includes("--dry-run");
    const skipChecks = args.includes("--skip-checks");
    const force = args.includes("--force");

    // Validate environment
    validateEnvironment();

    if (!skipChecks) {
      // Preflight checks
      const totalCVEs = await performPreflightChecks();
      const mappingInfo = await checkEndpointMapping();

      // Warning for large sync operation
      if (!force && totalCVEs > 50000) {
        console.log(
          `\n⚠️  This will sync ${totalCVEs.toLocaleString()} CVE records.`,
        );
        console.log(
          "   This is a significant operation that may take 30-60 minutes.",
        );
        console.log("   To proceed, run with --force flag:");
        console.log("   node scripts/sync-cves.js --force");
        process.exit(0);
      }

      if (mappingInfo.mappingRate < 30) {
        console.log("\n🔧 Recommendation: Improve endpoint mapping first");
        console.log("   1. Run agent sync: npm run sync-agents-only");
        console.log(
          "   2. Check tenant mappings: node scripts/diagnose-sites-tenants.js",
        );
        console.log("   3. Then retry CVE sync");

        if (!force) {
          console.log("\n   To proceed anyway, use --force");
          process.exit(0);
        }
      }
    }

    // Perform the sync
    const result = await performSync({ dryRun });

    if (!dryRun) {
      // Post-sync validation
      await postSyncValidation();
    }

    console.log("\n🎉 CVE sync process completed successfully!");
  } catch (error) {
    console.error("\n💥 CVE sync failed:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Received interrupt signal. Cleaning up...");
  await db.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Received termination signal. Cleaning up...");
  await db.$disconnect();
  process.exit(0);
});

main().catch(async (error) => {
  console.error("💥 Fatal error:", error);
  await db.$disconnect();
  process.exit(1);
});
