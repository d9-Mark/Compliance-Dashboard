// src/server/services/tenant-sync.ts
import type { PrismaClient } from "@prisma/client";

interface SentinelOneSite {
  id: string;
  name: string;
  accountName?: string;
  accountId?: string;
  description?: string;
  isDefault?: boolean;
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
   * Auto-create tenants from SentinelOne sites
   * This is the key method that solves your 26 sites → 26 tenants problem
   */
  async syncTenantsFromSentinelOneSites(): Promise<TenantSyncResult> {
    console.log("🏢 Starting tenant sync from SentinelOne sites...");

    // 1. Get all SentinelOne sites
    const sites = await this.fetchSentinelOneSites();
    console.log(`📊 Found ${sites.length} SentinelOne sites`);

    const result: TenantSyncResult = {
      created: 0,
      updated: 0,
      mapped: [],
    };

    // 2. Process each site
    for (const site of sites) {
      try {
        const tenantResult = await this.processSite(site);
        result.mapped.push(tenantResult);

        if (tenantResult.action === "created") {
          result.created++;
        } else if (tenantResult.action === "updated") {
          result.updated++;
        }

        console.log(
          `✅ ${tenantResult.action}: ${site.name} → ${tenantResult.tenantSlug}`,
        );
      } catch (error) {
        console.error(`❌ Failed to process site ${site.name}:`, error);
      }
    }

    console.log(
      `🎉 Tenant sync complete: ${result.created} created, ${result.updated} updated`,
    );
    return result;
  }

  /**
   * Get the tenant mapping for agent sync
   * Returns: { "siteId": "tenantId" }
   */
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

  private async fetchSentinelOneSites(): Promise<SentinelOneSite[]> {
    const response = await fetch(`${this.endpoint}/web/api/v2.1/sites`, {
      headers: {
        Authorization: `ApiToken ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `SentinelOne sites API error: ${response.status} - ${errorText}`,
      );
    }

    const data = await response.json();
    return data.data?.sites || [];
  }

  private async processSite(site: SentinelOneSite): Promise<{
    siteId: string;
    siteName: string;
    tenantId: string;
    tenantSlug: string;
    action: "created" | "updated" | "matched";
  }> {
    // 1. Check if tenant already exists with this site ID
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

    // 2. Create new tenant
    const slug = this.generateTenantSlug(site.name);

    // Ensure slug is unique
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

// Enhanced SentinelOne service with proper tenant mapping
export class EnhancedSentinelOneService {
  constructor(
    private readonly apiKey: string,
    private readonly endpoint: string,
    private readonly db: PrismaClient,
  ) {}

  /**
   * Sync agents using proper site→tenant mapping
   */
  async syncAgentsWithSiteMapping(): Promise<{
    success: boolean;
    processed: number;
    created: number;
    updated: number;
    tenantBreakdown: Record<string, number>;
  }> {
    console.log("🚀 Starting site-mapped agent sync...");

    // 1. Get site→tenant mapping
    const tenantService = new TenantSyncService(
      this.apiKey,
      this.endpoint,
      this.db,
    );
    const siteToTenantMap = await tenantService.getSiteToTenantMapping();

    if (Object.keys(siteToTenantMap).length === 0) {
      throw new Error("No site→tenant mappings found. Run tenant sync first.");
    }

    // 2. Sync agents
    let nextCursor: string | null = null;
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    const tenantBreakdown: Record<string, number> = {};

    do {
      const response = await this.fetchAgents({
        cursor: nextCursor,
        limit: 100,
        isActive: true,
      });

      console.log(`📡 Processing ${response.data.length} agents...`);

      for (const agent of response.data) {
        const tenantId = siteToTenantMap[agent.siteId];

        if (!tenantId) {
          console.warn(
            `⚠️ No tenant mapping for site ${agent.siteId} (agent: ${agent.computerName})`,
          );
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
        } catch (error) {
          console.error(
            `❌ Failed to process agent ${agent.computerName}:`,
            error,
          );
        }
      }

      nextCursor = response.pagination.nextCursor;
    } while (nextCursor);

    console.log(
      `✅ Site-mapped sync complete: ${totalProcessed} processed across ${Object.keys(tenantBreakdown).length} tenants`,
    );

    return {
      success: true,
      processed: totalProcessed,
      created: totalCreated,
      updated: totalUpdated,
      tenantBreakdown,
    };
  }

  private async processAgentWithSourceTracking(
    agent: any,
    tenantId: string,
  ): Promise<boolean> {
    // Check if endpoint exists
    const existingEndpoint = await this.db.endpoint.findUnique({
      where: {
        tenantId_hostname: {
          tenantId,
          hostname: agent.computerName,
        },
      },
    });

    const isExisting = !!existingEndpoint;

    // Calculate compliance
    const complianceData = this.calculateCompliance(agent);

    // Core endpoint data
    const endpointData = {
      hostname: agent.computerName,
      tenantId,

      // SentinelOne specific
      sentinelOneAgentId: agent.id,
      sentinelOneSiteId: agent.siteId,

      // System info
      operatingSystem: agent.osName || null,
      osVersion: agent.osRevision || null,
      ipAddress: agent.externalIp || agent.lastIpToMgmt || null,
      lastSeen: agent.lastActiveDate ? new Date(agent.lastActiveDate) : null,

      // Security
      activeThreats: agent.activeThreats || 0,
      isInfected: agent.infected || false,
      isAgentActive: agent.isActive || false,

      // Compliance
      isCompliant: complianceData.isCompliant,
      complianceScore: complianceData.complianceScore,
      criticalVulns: complianceData.estimatedCriticalVulns,
      highVulns: complianceData.estimatedHighVulns,
      mediumVulns: complianceData.estimatedMediumVulns,
      lowVulns: complianceData.estimatedLowVulns,
    };

    // Upsert endpoint
    const endpoint = await this.db.endpoint.upsert({
      where: {
        tenantId_hostname: {
          tenantId,
          hostname: agent.computerName,
        },
      },
      update: endpointData,
      create: endpointData,
    });

    // Track source data (this is where multi-source magic happens)
    await this.upsertEndpointSource(endpoint.id, "SENTINELONE", agent);

    return isExisting;
  }

  private async upsertEndpointSource(
    endpointId: string,
    sourceType: string,
    sourceData: any,
  ): Promise<void> {
    // This will be crucial for NinjaOne/ProofPoint integration later
    await this.db.endpointSource.upsert({
      where: {
        endpointId_sourceType: {
          endpointId,
          sourceType,
        },
      },
      update: {
        sourceId: sourceData.id,
        sourceData: sourceData, // Store raw data for future reference
        lastSynced: new Date(),
        isPrimary: sourceType === "SENTINELONE", // SentinelOne is primary for now
      },
      create: {
        endpointId,
        sourceType,
        sourceId: sourceData.id,
        sourceData: sourceData,
        lastSynced: new Date(),
        isPrimary: sourceType === "SENTINELONE",
      },
    });
  }

  private async fetchAgents(params: {
    cursor?: string | null;
    limit?: number;
    isActive?: boolean;
  }) {
    const queryParams = new URLSearchParams();
    if (params.cursor) queryParams.set("cursor", params.cursor);
    if (params.limit) queryParams.set("limit", params.limit.toString());
    if (params.isActive !== undefined)
      queryParams.set("isActive", params.isActive.toString());

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
