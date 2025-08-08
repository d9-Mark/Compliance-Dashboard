// src/server/api/routers/sentinelone-complete.ts
import { z } from "zod";
import { env } from "~/env";
import {
  adminProcedure,
  createTRPCRouter,
  getTenantFilter,
  tenantProcedure,
} from "~/server/api/trpc";
import {
  TenantSyncService,
  EnhancedSentinelOneService,
} from "~/server/services/tenant-sync";

export const sentinelOneRouter = createTRPCRouter({
  // Test SentinelOne connectivity
  testConnection: adminProcedure.mutation(async ({ ctx }) => {
    if (!env.SENTINELONE_API_KEY || !env.SENTINELONE_ENDPOINT) {
      throw new Error(
        "SentinelOne configuration missing. Please set SENTINELONE_API_KEY and SENTINELONE_ENDPOINT in your .env file.",
      );
    }

    try {
      const response = await fetch(
        `${env.SENTINELONE_ENDPOINT}/web/api/v2.1/sites`,
        {
          headers: {
            Authorization: `ApiToken ${env.SENTINELONE_API_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API Error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const data = await response.json();

      return {
        success: true,
        message: "SentinelOne connection successful",
        endpoint: env.SENTINELONE_ENDPOINT,
        totalSites: data.data?.sites?.length || 0,
        sampleSite: data.data?.sites?.[0]?.name || "None found",
      };
    } catch (error) {
      console.error("❌ SentinelOne connection test failed:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        endpoint: env.SENTINELONE_ENDPOINT,
      };
    }
  }),

  // **STEP 1: Create tenants from SentinelOne sites**
  syncTenants: adminProcedure.mutation(async ({ ctx }) => {
    if (!env.SENTINELONE_API_KEY || !env.SENTINELONE_ENDPOINT) {
      throw new Error("SentinelOne configuration missing.");
    }

    const tenantService = new TenantSyncService(
      env.SENTINELONE_API_KEY,
      env.SENTINELONE_ENDPOINT,
      ctx.db,
    );

    console.log(`🏢 Starting tenant sync from SentinelOne sites...`);
    const result = await tenantService.syncTenantsFromSentinelOneSites();
    console.log(`✅ Tenant sync completed:`, result);

    return result;
  }),

  // **STEP 2: Sync agents to auto-created tenants**
  syncAgents: adminProcedure.mutation(async ({ ctx }) => {
    if (!env.SENTINELONE_API_KEY || !env.SENTINELONE_ENDPOINT) {
      throw new Error("SentinelOne configuration missing.");
    }

    const agentService = new EnhancedSentinelOneService(
      env.SENTINELONE_API_KEY,
      env.SENTINELONE_ENDPOINT,
      ctx.db,
    );

    console.log(`🚀 Starting site-mapped agent sync...`);
    const result = await agentService.syncAgentsWithSiteMapping();
    console.log(`✅ Agent sync completed:`, result);

    return result;
  }),

  // **FULL SYNC: Do both tenant sync and agent sync**
  fullSync: adminProcedure.mutation(async ({ ctx }) => {
    if (!env.SENTINELONE_API_KEY || !env.SENTINELONE_ENDPOINT) {
      throw new Error("SentinelOne configuration missing.");
    }

    const tenantService = new TenantSyncService(
      env.SENTINELONE_API_KEY,
      env.SENTINELONE_ENDPOINT,
      ctx.db,
    );

    const agentService = new EnhancedSentinelOneService(
      env.SENTINELONE_API_KEY,
      env.SENTINELONE_ENDPOINT,
      ctx.db,
    );

    // Step 1: Sync tenants
    console.log(`🏢 Step 1: Syncing tenants from SentinelOne sites...`);
    const tenantResult = await tenantService.syncTenantsFromSentinelOneSites();
    console.log(
      `✅ Tenant sync: ${tenantResult.created} created, ${tenantResult.updated} updated`,
    );

    // Step 2: Sync agents
    console.log(`🚀 Step 2: Syncing agents with site mapping...`);
    const agentResult = await agentService.syncAgentsWithSiteMapping();
    console.log(
      `✅ Agent sync: ${agentResult.processed} processed across ${Object.keys(agentResult.tenantBreakdown).length} tenants`,
    );

    return {
      success: true,
      tenants: tenantResult,
      agents: agentResult,
      summary: {
        tenantsCreated: tenantResult.created,
        tenantsUpdated: tenantResult.updated,
        agentsProcessed: agentResult.processed,
        agentsCreated: agentResult.created,
        agentsUpdated: agentResult.updated,
        tenantsWithData: Object.keys(agentResult.tenantBreakdown).length,
      },
    };
  }),

  // Get site-to-tenant mapping
  getTenantMapping: adminProcedure.query(async ({ ctx }) => {
    if (!env.SENTINELONE_API_KEY || !env.SENTINELONE_ENDPOINT) {
      throw new Error("SentinelOne configuration missing.");
    }

    const tenantService = new TenantSyncService(
      env.SENTINELONE_API_KEY,
      env.SENTINELONE_ENDPOINT,
      ctx.db,
    );

    const mapping = await tenantService.getSiteToTenantMapping();

    // Get tenant details
    const tenantDetails = await ctx.db.tenant.findMany({
      where: {
        sentinelOneSiteId: { not: null },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        sentinelOneSiteId: true,
        _count: {
          select: {
            endpoints: true,
          },
        },
      },
    });

    return {
      mappingCount: Object.keys(mapping).length,
      tenants: tenantDetails,
      rawMapping: mapping,
    };
  }),

  // Get multi-source endpoint summary
  getMultiSourceSummary: tenantProcedure
    .input(z.object({ tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

      // Get endpoints with source information
      const endpoints = await ctx.db.endpoint.findMany({
        where: filter,
        include: {
          endpointSources: {
            select: {
              sourceType: true,
              isPrimary: true,
              lastSynced: true,
            },
          },
          _count: {
            select: {
              endpointSources: true,
            },
          },
        },
        take: 50, // Limit for performance
      });

      // Analyze source distribution
      const sourceStats = {
        SENTINELONE: 0,
        NINJAONE: 0,
        PROOFPOINT: 0,
        multiSource: 0,
      };

      const endpointSummary = endpoints.map((endpoint) => {
        const sources = endpoint.endpointSources.map((es) => es.sourceType);
        const primarySource =
          endpoint.endpointSources.find((es) => es.isPrimary)?.sourceType ||
          sources[0];

        // Count source usage
        sources.forEach((source) => {
          if (sourceStats[source as keyof typeof sourceStats] !== undefined) {
            sourceStats[source as keyof typeof sourceStats]++;
          }
        });

        if (sources.length > 1) {
          sourceStats.multiSource++;
        }

        return {
          id: endpoint.id,
          hostname: endpoint.hostname,
          sources,
          primarySource,
          sourceCount: sources.length,
          isCompliant: endpoint.isCompliant,
          complianceScore: endpoint.complianceScore,
          lastSeen: endpoint.lastSeen,
        };
      });

      return {
        totalEndpoints: endpoints.length,
        sourceStats,
        endpoints: endpointSummary,
      };
    }),

  // Get sync status
  getSyncStatus: tenantProcedure
    .input(z.object({ tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

      const syncJobs = await ctx.db.syncJob.findMany({
        where: {
          ...filter,
          source: "SENTINELONE",
        },
        orderBy: { startedAt: "desc" },
        take: 10,
      });

      const latestByStatus = syncJobs.reduce(
        (acc, job) => {
          if (!acc[job.status] || acc[job.status].startedAt < job.startedAt) {
            acc[job.status] = job;
          }
          return acc;
        },
        {} as Record<string, (typeof syncJobs)[0]>,
      );

      const completedJobs = syncJobs.filter(
        (job) => job.status === "COMPLETED",
      );
      const avgProcessingTime =
        completedJobs.length > 0
          ? completedJobs.reduce((sum, job) => {
              const duration =
                job.completedAt && job.startedAt
                  ? job.completedAt.getTime() - job.startedAt.getTime()
                  : 0;
              return sum + duration;
            }, 0) / completedJobs.length
          : 0;

      return {
        latestJobs: latestByStatus,
        recentJobs: syncJobs.slice(0, 5),
        statistics: {
          totalJobs: syncJobs.length,
          completedJobs: completedJobs.length,
          failedJobs: syncJobs.filter((job) => job.status === "FAILED").length,
          averageProcessingTimeMs: Math.round(avgProcessingTime),
          lastSyncTime: syncJobs[0]?.startedAt || null,
        },
      };
    }),
});
