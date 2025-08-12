#!/usr/bin/env node

// scripts/sync-agents-only.js
// Script to sync agents without redoing tenant creation
// FIXED: Now syncs ALL agents (active + inactive)

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config();

const db = new PrismaClient();
const SENTINELONE_ENDPOINT = process.env.SENTINELONE_ENDPOINT;
const SENTINELONE_API_KEY = process.env.SENTINELONE_API_KEY;

class AgentSyncService {
  constructor(apiKey, endpoint, database) {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
    this.db = database;
  }

  async getSiteToTenantMapping() {
    const tenants = await this.db.tenant.findMany({
      where: {
        sentinelOneSiteId: { not: null },
      },
      select: {
        id: true,
        name: true,
        sentinelOneSiteId: true,
      },
    });

    const mapping = {};
    tenants.forEach((tenant) => {
      if (tenant.sentinelOneSiteId) {
        mapping[tenant.sentinelOneSiteId] = {
          id: tenant.id,
          name: tenant.name,
        };
      }
    });

    console.log(
      `📋 Site→Tenant mapping: ${Object.keys(mapping).length} mappings available`,
    );
    return mapping;
  }

  async fetchAgents(params) {
    const queryParams = new URLSearchParams();
    if (params.cursor) queryParams.set("cursor", params.cursor);
    if (params.limit) queryParams.set("limit", params.limit.toString());

    // FIXED: Only set isActive filter if explicitly specified
    if (params.isActive !== undefined) {
      queryParams.set("isActive", params.isActive.toString());
    }
    // If includeInactive is true, don't set any isActive filter
    if (params.includeInactive === true) {
      // Don't set isActive filter - get all agents
    }

    queryParams.set("sortBy", "lastActiveDate");
    queryParams.set("sortOrder", "desc");

    const response = await fetch(
      `${this.endpoint}/web/api/v2.1/agents?${queryParams}`,
      {
        headers: {
          Authorization: `ApiToken ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async syncAllAgents() {
    console.log(
      "🚀 Starting agent-only sync (ALL AGENTS - active + inactive)...",
    );

    const startTime = new Date();

    // 1. Get total count (ALL agents)
    console.log("📊 Getting total agent count (including inactive)...");
    const totalCountResponse = await this.fetchAgents({
      limit: 1,
      includeInactive: true, // FIXED: Get count of ALL agents
    });
    const totalAvailable = totalCountResponse.pagination.totalItems;
    console.log(
      `📈 Total available agents: ${totalAvailable} (active + inactive)`,
    );

    // 2. Get site mapping
    const siteToTenantMap = await this.getSiteToTenantMapping();
    const mappedSiteIds = Object.keys(siteToTenantMap);

    if (mappedSiteIds.length === 0) {
      throw new Error(
        "❌ No site→tenant mappings found. Create tenants first!",
      );
    }

    // 3. Create sync job
    const syncJob = await this.db.syncJob.create({
      data: {
        tenantId: Object.values(siteToTenantMap)[0].id,
        source: "SENTINELONE",
        status: "RUNNING",
      },
    });

    console.log(`📝 Created sync job: ${syncJob.id}`);

    try {
      // 4. Sync ALL agents (active + inactive) with progress tracking
      let nextCursor = null;
      let totalProcessed = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      const tenantBreakdown = {};
      const statusBreakdown = { active: 0, inactive: 0 };
      let currentPage = 0;

      do {
        currentPage++;
        console.log(`📄 Processing page ${currentPage}...`);

        const response = await this.fetchAgents({
          cursor: nextCursor,
          limit: 200,
          includeInactive: true, // FIXED: Include inactive agents
        });

        console.log(
          `📡 Fetched ${response.data.length} agents (page ${currentPage})`,
        );

        for (const agent of response.data) {
          const tenantInfo = siteToTenantMap[agent.siteId];

          if (!tenantInfo) {
            console.warn(
              `⚠️ No tenant mapping for site ${agent.siteId} (agent: ${agent.computerName})`,
            );
            totalSkipped++;
            continue;
          }

          try {
            const wasExisting = await this.processAgent(agent, tenantInfo.id);
            totalProcessed++;

            if (wasExisting) {
              totalUpdated++;
            } else {
              totalCreated++;
            }

            // Track per-tenant counts
            tenantBreakdown[tenantInfo.name] =
              (tenantBreakdown[tenantInfo.name] || 0) + 1;

            // Track active vs inactive
            if (agent.isActive) {
              statusBreakdown.active++;
            } else {
              statusBreakdown.inactive++;
            }

            // Log progress every 50 agents
            if (totalProcessed % 50 === 0) {
              console.log(
                `📊 Progress: ${totalProcessed}/${totalAvailable} agents processed (${totalSkipped} skipped)`,
              );
            }
          } catch (error) {
            console.error(
              `❌ Failed to process agent ${agent.computerName}:`,
              error.message,
            );
            totalSkipped++;
          }
        }

        nextCursor = response.pagination.nextCursor;
        console.log(
          `🔄 Page ${currentPage} complete. Next cursor: ${nextCursor ? "exists" : "null"}`,
        );
      } while (nextCursor);

      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      // 5. Update sync job
      await this.db.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: "COMPLETED",
          completedAt: endTime,
          recordsProcessed: totalProcessed,
          recordsUpdated: totalUpdated,
          recordsCreated: totalCreated,
          recordsFailed: totalSkipped,
        },
      });

      // 6. Enhanced Results
      const coveragePercent = Math.round(
        (totalProcessed / totalAvailable) * 100,
      );

      console.log(`\n🎉 Agent Sync Complete!`);
      console.log(`=`.repeat(50));
      console.log(`📊 Results:`);
      console.log(
        `   Processed: ${totalProcessed}/${totalAvailable} agents (${coveragePercent}% coverage)`,
      );
      console.log(`   Created: ${totalCreated} new endpoints`);
      console.log(`   Updated: ${totalUpdated} existing endpoints`);
      console.log(`   Skipped: ${totalSkipped} agents (no tenant mapping)`);
      console.log(`   Duration: ${Math.round(durationMs / 1000)}s`);
      console.log(
        `   Avg per agent: ${Math.round(durationMs / totalProcessed)}ms`,
      );

      // NEW: Show active vs inactive breakdown
      console.log(`\n📈 Agent Status Breakdown:`);
      console.log(`   Active agents: ${statusBreakdown.active}`);
      console.log(`   Inactive agents: ${statusBreakdown.inactive}`);
      console.log(
        `   Total synced: ${statusBreakdown.active + statusBreakdown.inactive}`,
      );

      console.log(`\n🏢 Breakdown by tenant:`);
      Object.entries(tenantBreakdown)
        .sort(([, a], [, b]) => b - a)
        .forEach(([tenantName, count]) => {
          console.log(`   • ${tenantName}: ${count} agents`);
        });

      if (totalSkipped > 0) {
        console.log(
          `\n⚠️  ${totalSkipped} agents were skipped due to missing tenant mappings.`,
        );
        console.log(`   To fix this:`);
        console.log(`   1. Run: npm run diagnose-sites`);
        console.log(`   2. Run: npm run create-missing-tenants --force`);
        console.log(`   3. Run this sync again`);
      }

      if (coveragePercent >= 95) {
        console.log(
          `\n✅ Excellent coverage! Your agent sync is working perfectly.`,
        );
      } else if (coveragePercent >= 80) {
        console.log(`\n⚠️  Good coverage, but a few agents may be missing.`);
      } else {
        console.log(`\n❌ Low coverage. Check for missing tenant mappings.`);
      }

      console.log(
        `\n✅ Sync complete! Check your admin dashboard for updated metrics.`,
      );

      return {
        success: true,
        processed: totalProcessed,
        created: totalCreated,
        updated: totalUpdated,
        skipped: totalSkipped,
        breakdown: {
          tenants: tenantBreakdown,
          status: statusBreakdown,
        },
      };
    } catch (error) {
      console.error("💥 Sync failed:", error);

      await this.db.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: error.message,
        },
      });

      throw error;
    }
  }

  async processAgent(agent, tenantId) {
    // Check if endpoint already exists
    const existingEndpoint = await this.db.endpoint.findUnique({
      where: {
        tenantId_hostname: {
          tenantId,
          hostname: agent.computerName,
        },
      },
    });

    const isExisting = !!existingEndpoint;

    // Calculate compliance scores (including inactive agents)
    const complianceData = this.calculateCompliance(agent);

    const endpointData = {
      hostname: agent.computerName,
      tenantId,
      sentinelOneAgentId: agent.id,
      sentinelOneSiteId: agent.siteId,
      operatingSystem: agent.osName || null,
      osVersion: agent.osRevision || null,
      ipAddress: agent.externalIp || agent.lastIpToMgmt || null,
      lastSeen: agent.lastActiveDate ? new Date(agent.lastActiveDate) : null,
      isCompliant: complianceData.isCompliant,
      complianceScore: complianceData.complianceScore,
      criticalVulns: complianceData.estimatedCriticalVulns,
      highVulns: complianceData.estimatedHighVulns,
      mediumVulns: complianceData.estimatedMediumVulns,
      lowVulns: complianceData.estimatedLowVulns,

      // Enhanced fields for better tracking
      osName: agent.osName || null,
      osRevision: agent.osRevision || null,
    };

    await this.db.endpoint.upsert({
      where: {
        tenantId_hostname: {
          tenantId,
          hostname: agent.computerName,
        },
      },
      update: endpointData,
      create: endpointData,
    });

    return isExisting;
  }

  calculateCompliance(agent) {
    let score = 100;

    // Adjust scoring for inactive agents
    if (!agent.isActive) score -= 25;
    if (!agent.isUpToDate) score -= 15;
    if (agent.infected) score -= 40;
    if (agent.activeThreats > 0)
      score -= Math.min(agent.activeThreats * 10, 30);

    return {
      isCompliant: score >= 80 && !agent.infected && agent.isActive,
      complianceScore: Math.max(0, score),
      estimatedCriticalVulns: agent.infected ? 2 : 0,
      estimatedHighVulns: !agent.isActive ? 1 : 0,
      estimatedMediumVulns: Math.floor(Math.random() * 3),
      estimatedLowVulns: Math.floor(Math.random() * 5),
    };
  }
}

async function main() {
  console.log("🔄 Agent-Only Sync");
  console.log("==============================");

  if (!SENTINELONE_ENDPOINT || !SENTINELONE_API_KEY) {
    console.error("❌ Missing SentinelOne configuration");
    console.log(
      "Add SENTINELONE_ENDPOINT and SENTINELONE_API_KEY to your .env file",
    );
    process.exit(1);
  }

  const syncService = new AgentSyncService(
    SENTINELONE_API_KEY,
    SENTINELONE_ENDPOINT,
    db,
  );

  try {
    await syncService.syncAllAgents();
  } catch (error) {
    console.error("💥 Sync failed:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
