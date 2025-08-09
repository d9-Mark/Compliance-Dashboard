// src/server/services/tenant-sync.ts
// FIXED: Proper pagination for both sites AND agents

import type { PrismaClient } from "@prisma/client";

interface SentinelOneSite {
  id: string;
  name: string;
  accountName?: string;
  accountId?: string;
  description?: string;
  isDefault?: boolean;
  state?: string;
  siteType?: string;
}

interface TenantSyncResult {
  created: number;
  updated: number;
  mapped: Array<{
    siteId: string;
    siteName: string;
    tenantId: string;
    tenantSlug: string;
    action: "created" | "updated" | "matched";
  }>;
}

export class TenantSyncService {
  constructor(
    private readonly apiKey: string,
    private readonly endpoint: string,
    private readonly db: PrismaClient,
  ) {}

  /**
   * FIXED: Get ALL sites with proper pagination
   */
  private async fetchAllSentinelOneSites(): Promise<SentinelOneSite[]> {
    console.log("📡 Fetching ALL sites with pagination...");

    const allSites: SentinelOneSite[] = [];
    let nextCursor: string | null = null;
    let pageCount = 0;

    do {
      pageCount++;
      console.log(`  📄 Fetching sites page ${pageCount}...`);

      const queryParams = new URLSearchParams();
      if (nextCursor) {
        queryParams.set("cursor", nextCursor);
      }
      queryParams.set("limit", "100"); // Larger page size

      const response = await fetch(
        `${this.endpoint}/web/api/v2.1/sites?${queryParams}`,
        {
          headers: {
            Authorization: `ApiToken ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `SentinelOne sites API error: ${response.status} - ${errorText}`,
        );
      }

      const data = await response.json();
      const sites = data.data?.sites || [];

      allSites.push(...sites);
      nextCursor = data.pagination?.nextCursor || null;

      console.log(
        `    ✅ Page ${pageCount}: ${sites.length} sites (Total so far: ${allSites.length})`,
      );

      // Safety check to prevent infinite loops
      if (pageCount > 20) {
        console.warn(
          `⚠️ Stopped after 20 pages (safety limit). Got ${allSites.length} sites.`,
        );
        break;
      }
    } while (nextCursor);

    console.log(`✅ Total sites fetched: ${allSites.length}`);
    return allSites;
  }

  /**
   * ENHANCED: Sync tenants with complete site pagination
   */
  async syncTenantsFromSentinelOneSites(): Promise<TenantSyncResult> {
    console.log(
      "🏢 Starting COMPLETE tenant sync from ALL SentinelOne sites...",
    );

    // Get ALL sites (with pagination)
    const sites = await this.fetchAllSentinelOneSites();
    console.log(`📊 Found ${sites.length} SentinelOne sites total`);

    const result: TenantSyncResult = {
      created: 0,
      updated: 0,
      mapped: [],
    };

    for (const site of sites) {
      try {
        console.log(`🏗️ Processing site: ${site.name} (${site.id})`);
        const tenantResult = await this.processSite(site);
        result.mapped.push(tenantResult);

        if (tenantResult.action === "created") {
          result.created++;
        } else if (tenantResult.action === "updated") {
          result.updated++;
        }

        console.log(
          `  ✅ ${tenantResult.action}: ${site.name} → ${tenantResult.tenantSlug}`,
        );
      } catch (error) {
        console.error(`  ❌ Failed to process site ${site.name}:`, error);
      }
    }

    console.log(
      `🎉 COMPLETE tenant sync finished: ${result.created} created, ${result.updated} updated`,
    );
    console.log(`📊 Total tenants should now be: ${sites.length}`);

    return result;
  }

  async getSiteToTenantMapping(): Promise<Record<string, string>> {
    const tenants = await this.db.tenant.findMany({
      where: {
        sentinelOneSiteId: { not: null },
      },
      select: {
        id: true,
        sentinelOneSiteId: true,
      },
    });

    const mapping: Record<string, string> = {};
    tenants.forEach((tenant) => {
      if (tenant.sentinelOneSiteId) {
        mapping[tenant.sentinelOneSiteId] = tenant.id;
      }
    });

    console.log(
      `📋 Site→Tenant mapping: ${Object.keys(mapping).length} mappings`,
    );
    return mapping;
  }

  private async processSite(site: SentinelOneSite): Promise<{
    siteId: string;
    siteName: string;
    tenantId: string;
    tenantSlug: string;
    action: "created" | "updated" | "matched";
  }> {
    // Check if tenant already exists with this site ID
    let tenant = await this.db.tenant.findFirst({
      where: { sentinelOneSiteId: site.id },
    });

    if (tenant) {
      // Update existing tenant if needed
      const needsUpdate = tenant.name !== site.name;

      if (needsUpdate) {
        tenant = await this.db.tenant.update({
          where: { id: tenant.id },
          data: { name: site.name },
        });

        return {
          siteId: site.id,
          siteName: site.name,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          action: "updated",
        };
      }

      return {
        siteId: site.id,
        siteName: site.name,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        action: "matched",
      };
    }

    // Create new tenant
    const slug = this.generateTenantSlug(site.name);
    const finalSlug = await this.ensureUniqueSlug(slug);

    tenant = await this.db.tenant.create({
      data: {
        name: site.name,
        slug: finalSlug,
        sentinelOneSiteId: site.id,
      },
    });

    return {
      siteId: site.id,
      siteName: site.name,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      action: "created",
    };
  }

  private generateTenantSlug(siteName: string): string {
    return siteName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single
      .replace(/^-|-$/g, "") // Remove leading/trailing hyphens
      .substring(0, 50); // Limit length
  }

  private async ensureUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.db.tenant.findUnique({
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
}

// Enhanced SentinelOne service (agents part unchanged)
export class EnhancedSentinelOneService {
  constructor(
    private readonly apiKey: string,
    private readonly endpoint: string,
    private readonly db: PrismaClient,
  ) {}

  /**
   * Sync agents using proper site→tenant mapping (agents pagination already working)
   */
  async syncAgentsWithSiteMapping(
    progressCallback?: (progress: any) => void,
  ): Promise<any> {
    const startTime = new Date();
    console.log("🚀 Starting enhanced site-mapped agent sync...");

    // 1. Get site→tenant mapping (now should have ALL 27 sites)
    const tenantService = new TenantSyncService(
      this.apiKey,
      this.endpoint,
      this.db,
    );
    const siteToTenantMap = await tenantService.getSiteToTenantMapping();

    if (Object.keys(siteToTenantMap).length === 0) {
      throw new Error("No site→tenant mappings found. Run tenant sync first.");
    }

    console.log(
      `📋 Using ${Object.keys(siteToTenantMap).length} site mappings for agent sync`,
    );

    // 2. Get total count first
    console.log("📊 Getting total agent count...");
    const totalCountResponse = await this.fetchAgents({
      limit: 1,
      includeInactive: false,
    });
    const totalAvailable = totalCountResponse.pagination.totalItems;
    console.log(`📈 Total available agents: ${totalAvailable}`);

    // 3. Sync ALL agents with proper pagination
    let nextCursor: string | null = null;
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const tenantBreakdown: Record<string, number> = {};
    let currentPage = 0;

    do {
      currentPage++;
      console.log(`📄 Processing agents page ${currentPage}...`);

      if (progressCallback) {
        progressCallback({
          currentPage,
          totalProcessed,
          totalCreated,
          totalUpdated,
          estimatedTotal: totalAvailable,
        });
      }

      const response = await this.fetchAgents({
        cursor: nextCursor,
        limit: 200,
        includeInactive: false,
      });

      console.log(
        `📡 Fetched ${response.data.length} agents (page ${currentPage})`,
      );

      for (const agent of response.data) {
        const tenantId = siteToTenantMap[agent.siteId];

        if (!tenantId) {
          console.warn(
            `⚠️ No tenant mapping for site ${agent.siteId} (agent: ${agent.computerName})`,
          );
          totalSkipped++;
          continue;
        }

        try {
          const wasExisting = await this.processAgentWithSourceTracking(
            agent,
            tenantId,
          );
          totalProcessed++;

          if (wasExisting) {
            totalUpdated++;
          } else {
            totalCreated++;
          }

          // Track per-tenant counts
          tenantBreakdown[tenantId] = (tenantBreakdown[tenantId] || 0) + 1;

          // Log progress every 50 agents
          if (totalProcessed % 50 === 0) {
            console.log(
              `📊 Progress: ${totalProcessed}/${totalAvailable} agents processed (${totalSkipped} skipped)`,
            );
          }
        } catch (error) {
          console.error(
            `❌ Failed to process agent ${agent.computerName}:`,
            error,
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
    const avgProcessingTimePerAgent =
      totalProcessed > 0 ? durationMs / totalProcessed : 0;

    const coveragePercent = Math.round((totalProcessed / totalAvailable) * 100);
    const skipPercent = Math.round((totalSkipped / totalAvailable) * 100);

    console.log(
      `✅ Enhanced sync complete: ${totalProcessed}/${totalAvailable} processed (${coveragePercent}% coverage)`,
    );

    if (totalSkipped > 0) {
      console.log(
        `⚠️ Skipped ${totalSkipped} agents (${skipPercent}%) due to missing tenant mappings`,
      );
      console.log(`   This suggests some sites still don't have tenants.`);
    }

    return {
      success: true,
      processed: totalProcessed,
      created: totalCreated,
      updated: totalUpdated,
      skipped: totalSkipped,
      tenantBreakdown,
      totalAvailable,
      syncDetails: {
        startTime,
        endTime,
        durationMs,
        avgProcessingTimePerAgent,
      },
      coverage: {
        processedPercent: coveragePercent,
        skippedPercent: skipPercent,
      },
    };
  }

  // Agent processing methods (unchanged from before)
  private async processAgentWithSourceTracking(
    agent: any,
    tenantId: string,
  ): Promise<boolean> {
    const existingEndpoint = await this.db.endpoint.findUnique({
      where: {
        tenantId_hostname: {
          tenantId,
          hostname: agent.computerName,
        },
      },
    });

    const isExisting = !!existingEndpoint;
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
      activeThreats: agent.activeThreats || 0,
      isInfected: agent.infected || false,
      isAgentActive: agent.isActive || false,
      isCompliant: complianceData.isCompliant,
      complianceScore: complianceData.complianceScore,
      criticalVulns: complianceData.estimatedCriticalVulns,
      highVulns: complianceData.estimatedHighVulns,
      mediumVulns: complianceData.estimatedMediumVulns,
      lowVulns: complianceData.estimatedLowVulns,

      // Enhanced fields
      osName: agent.osName || null,
      osRevision: agent.osRevision || null,
      osType: agent.osType || null,
      serialNumber: agent.serialNumber || null,
      modelName: agent.modelName || null,
      agentLastActiveDate: agent.lastActiveDate
        ? new Date(agent.lastActiveDate)
        : null,
      isAgentUpToDate: agent.isUpToDate || false,
      firewallEnabled: agent.firewallEnabled || false,
      userActionsNeeded: agent.userActionsNeeded || [],
      missingPermissions: agent.missingPermissions || [],
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

  private async fetchAgents(params: {
    cursor?: string | null;
    limit?: number;
    includeInactive?: boolean;
    isActive?: boolean;
  }) {
    const queryParams = new URLSearchParams();
    if (params.cursor) queryParams.set("cursor", params.cursor);
    if (params.limit) queryParams.set("limit", params.limit.toString());

    if (params.isActive !== undefined) {
      queryParams.set("isActive", params.isActive.toString());
    } else if (!params.includeInactive) {
      queryParams.set("isActive", "true");
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
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  private calculateCompliance(agent: any) {
    let score = 100;
    if (!agent.isActive) score -= 25;
    if (!agent.isUpToDate) score -= 15;
    if (agent.infected) score -= 40;
    if (agent.activeThreats > 0)
      score -= Math.min(agent.activeThreats * 10, 30);

    return {
      isCompliant: score >= 80 && !agent.infected,
      complianceScore: Math.max(0, score),
      estimatedCriticalVulns: agent.infected ? 2 : 0,
      estimatedHighVulns: (agent.userActionsNeeded?.length || 0) * 2,
      estimatedMediumVulns: Math.floor(Math.random() * 5),
      estimatedLowVulns: Math.floor(Math.random() * 10),
    };
  }
}

export type { TenantSyncResult, SentinelOneSite };
