#!/usr/bin/env node

// scripts/test-sentinelone.js
// Test script to verify SentinelOne API connectivity and data structure

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

// Load environment variables
config();

const db = new PrismaClient();

// Configuration
const SENTINELONE_ENDPOINT = process.env.SENTINELONE_ENDPOINT;
const SENTINELONE_API_KEY = process.env.SENTINELONE_API_KEY;

async function testSentinelOneConnection() {
  console.log("🔍 Testing SentinelOne API Connection...\n");

  // Check environment variables
  if (!SENTINELONE_ENDPOINT) {
    console.error("❌ SENTINELONE_ENDPOINT not found in environment variables");
    console.log(
      "   Add this to your .env file: SENTINELONE_ENDPOINT=https://your-org.sentinelone.net",
    );
    return false;
  }

  if (!SENTINELONE_API_KEY) {
    console.error("❌ SENTINELONE_API_KEY not found in environment variables");
    console.log(
      "   Add this to your .env file: SENTINELONE_API_KEY=your-api-key-here",
    );
    return false;
  }

  console.log("✅ Environment variables found:");
  console.log(`   Endpoint: ${SENTINELONE_ENDPOINT}`);
  console.log(`   API Key: ${SENTINELONE_API_KEY.substring(0, 10)}...`);
  console.log();

  try {
    // Test basic connectivity
    console.log("🔗 Testing API connectivity...");

    // Clean up API key (remove any spaces/newlines)
    const cleanApiKey = SENTINELONE_API_KEY.trim();
    console.log(
      `   Clean API Key: ${cleanApiKey.substring(0, 10)}... (length: ${cleanApiKey.length})`,
    );

    const testUrl = `${SENTINELONE_ENDPOINT}/web/api/v2.1/agents?limit=5`;
    console.log(`   Request URL: ${testUrl}`);
    console.log(`   Auth Header: ApiToken ${cleanApiKey.substring(0, 10)}...`);

    const response = await fetch(testUrl, {
      headers: {
        Authorization: `ApiToken ${cleanApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    console.log(
      `   Response status: ${response.status} ${response.statusText}`,
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API request failed:");
      console.error(`   Status: ${response.status}`);
      console.error(`   Error: ${errorText}`);

      if (response.status === 401) {
        console.log("\n💡 Troubleshooting tips:");
        console.log("   - Check your API key is correct");
        console.log(
          "   - Verify the API key hasn't expired (they expire every 6 months)",
        );
        console.log("   - Make sure your user has API access permissions");
      } else if (response.status === 404) {
        console.log("\n💡 Troubleshooting tips:");
        console.log("   - Check your endpoint URL is correct");
        console.log(
          "   - It should be something like: https://your-org.sentinelone.net",
        );
      }

      return false;
    }

    const data = await response.json();
    console.log("✅ API connection successful!");
    console.log(
      `   Total agents available: ${data.pagination?.totalItems || 0}`,
    );
    console.log(`   Agents in response: ${data.data?.length || 0}`);
    console.log();

    if (data.data && data.data.length > 0) {
      console.log("📊 Sample agent data structure:");
      const sampleAgent = data.data[0];
      console.log("   Agent fields available:");

      // Show key fields and their values
      const keyFields = [
        "id",
        "computerName",
        "osName",
        "osRevision",
        "osType",
        "agentVersion",
        "isActive",
        "isUpToDate",
        "activeThreats",
        "infected",
        "firewallEnabled",
        "appsVulnerabilityStatus",
        "userActionsNeeded",
        "missingPermissions",
        "lastActiveDate",
      ];

      keyFields.forEach((field) => {
        const value = sampleAgent[field];
        const displayValue = Array.isArray(value)
          ? `[${value.length} items]`
          : typeof value === "string" && value.length > 50
            ? value.substring(0, 50) + "..."
            : value;
        console.log(`   • ${field}: ${displayValue ?? "null"}`);
      });

      console.log();

      // Show compliance-relevant data
      console.log("🛡️  Compliance-relevant fields:");
      console.log(`   • Agent Active: ${sampleAgent.isActive ? "✅" : "❌"}`);
      console.log(
        `   • Agent Up to Date: ${sampleAgent.isUpToDate ? "✅" : "❌"}`,
      );
      console.log(`   • Infected: ${sampleAgent.infected ? "❌" : "✅"}`);
      console.log(`   • Active Threats: ${sampleAgent.activeThreats || 0}`);
      console.log(
        `   • Firewall Enabled: ${sampleAgent.firewallEnabled ? "✅" : "❌"}`,
      );
      console.log(
        `   • Apps Vuln Status: ${sampleAgent.appsVulnerabilityStatus || "unknown"}`,
      );
      console.log(
        `   • User Actions Needed: ${(sampleAgent.userActionsNeeded || []).length} items`,
      );
      console.log(
        `   • Missing Permissions: ${(sampleAgent.missingPermissions || []).length} items`,
      );
      console.log();

      // Windows version analysis
      if (sampleAgent.osType === "windows") {
        console.log("🪟 Windows version analysis:");
        console.log(`   • OS Name: ${sampleAgent.osName}`);
        console.log(`   • OS Revision: ${sampleAgent.osRevision}`);

        const buildMatch = sampleAgent.osRevision?.match(
          /(\\d+)\\.(\\d+)\\.(\\d+)/,
        );
        if (buildMatch) {
          const buildNumber = parseInt(buildMatch[3]);
          console.log(`   • Build Number: ${buildNumber}`);

          // Check against known compliance thresholds
          const complianceBuilds = {
            "Windows 11": [22631, 22621],
            "Windows 10": [19045],
            "Server 2022": [20348],
            "Server 2019": [17763],
          };

          let isCompliant = false;
          for (const [os, builds] of Object.entries(complianceBuilds)) {
            if (sampleAgent.osName?.includes(os)) {
              isCompliant = builds.includes(buildNumber);
              console.log(
                `   • ${os} Compliance: ${isCompliant ? "✅" : "❌"}`,
              );
              if (!isCompliant) {
                console.log(`   • Latest Build: ${Math.max(...builds)}`);
              }
              break;
            }
          }
        }
        console.log();
      }
    } else {
      console.log("⚠️  No agents found. This could mean:");
      console.log("   - No agents are deployed yet");
      console.log("   - Your API key doesn't have access to agents");
      console.log("   - Agents are in a different site/scope");
    }

    // Test accounts endpoint
    console.log("\n🏢 Testing accounts endpoint...");
    const accountsResponse = await fetch(
      `${SENTINELONE_ENDPOINT}/web/api/v2.1/sites`,
      {
        headers: {
          Authorization: `ApiToken ${cleanApiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    const sitesData = await accountsResponse.json();
    console.log(sitesData.data);
    sitesData.data.sites.forEach((site) => {
      console.log(`   • Site: ${site.name} (ID: ${site.id})`);
    });

    return true;
  } catch (error) {
    console.error("❌ Connection test failed:");
    console.error(`   Error: ${error.message}`);

    if (error.code === "ENOTFOUND") {
      console.log("\n💡 DNS resolution failed. Check your endpoint URL.");
    } else if (error.code === "ECONNREFUSED") {
      console.log("\n💡 Connection refused. Check if the endpoint is correct.");
    }

    return false;
  }
}

async function testDatabaseConnection() {
  console.log("🗄️  Testing database connection...");

  try {
    // Test database connectivity
    await db.$connect();
    console.log("✅ Database connection successful");

    // Check if we have any existing endpoints
    const endpointCount = await db.endpoint.count();
    console.log(`   Existing endpoints: ${endpointCount}`);

    // Check if we have tenants
    const tenantCount = await db.tenant.count();
    console.log(`   Existing tenants: ${tenantCount}`);

    if (tenantCount === 0) {
      console.log("⚠️  No tenants found. Run: npm run db:seed");
    }

    console.log();
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:");
    console.error(`   Error: ${error.message}`);
    console.log("\n💡 Make sure:");
    console.log("   - PostgreSQL is running");
    console.log("   - DATABASE_URL is correct in .env");
    console.log("   - Database migrations are up to date: npm run db:generate");
    return false;
  }
}

async function runFullTest() {
  console.log("🚀 SentinelOne Integration Test\n");
  console.log("=".repeat(50));
  console.log();

  const dbOk = await testDatabaseConnection();
  if (!dbOk) {
    console.log("❌ Database test failed. Fix database issues first.");
    process.exit(1);
  }

  const apiOk = await testSentinelOneConnection();
  if (!apiOk) {
    console.log("❌ SentinelOne API test failed. Check your configuration.");
    process.exit(1);
  }

  console.log("🎉 All tests passed!");
  console.log();
  console.log("Next steps:");
  console.log("1. Update your router to include the SentinelOne router:");
  console.log("   // In src/server/api/root.ts");
  console.log(
    '   import { sentinelOneRouter } from "~/server/api/routers/sentinelone-enhanced";',
  );
  console.log("   export const appRouter = createTRPCRouter({");
  console.log("     // ... your existing routers");
  console.log("     sentinelone: sentinelOneRouter,");
  console.log("   });");
  console.log();
  console.log("2. Test the sync from your admin dashboard or run:");
  console.log("   // In your app, call the sync endpoint");
  console.log();
  console.log("3. To run a sync test, create a test tenant and run:");
  console.log("   // In your dashboard, trigger a sync for a tenant");
}

async function main() {
  try {
    await runFullTest();
  } catch (error) {
    console.error("💥 Unexpected error:", error);
  } finally {
    await db.$disconnect();
  }
}

// Handle command line arguments
if (process.argv.includes("--api-only")) {
  testSentinelOneConnection().then((success) => {
    process.exit(success ? 0 : 1);
  });
} else if (process.argv.includes("--db-only")) {
  testDatabaseConnection()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .finally(() => db.$disconnect());
} else {
  main();
}

// Handle process termination gracefully
process.on("SIGINT", async () => {
  console.log("\\nShutting down...");
  await db.$disconnect();
  process.exit(0);
});
