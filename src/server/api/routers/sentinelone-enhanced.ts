// src/server/api/routers/sentinelone-enhanced.ts
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
  // Test SentinelOne connectivity with enhanced feedback
  testConnection: adminProcedure.mutation(async ({ ctx }) => {
    if (!env.SENTINELONE_API_KEY || !env.SENTINELONE_ENDPOINT) {
      throw new Error(
        "SentinelOne configuration missing. Please set SENTINELONE_API_KEY and SENTINELONE_ENDPOINT in your .env file.",
      );
    }

    try {
      console.log("🔗 Testing SentinelOne connection...");

      // Test sites endpoint first
      const sitesResponse = await fetch(
        `${env.SENTINELONE_ENDPOINT}/web/api/v2.1/sites`,
        {
          headers: {
            Authorization: `ApiToken ${env.SENTINELONE_API_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!sitesResponse.ok) {
        const errorText = await sitesResponse.text();
        throw new Error(
          `Sites API Error: ${sitesResponse.status} ${sitesResponse.statusText} - ${errorText}`,
        );
      }

      const sitesData = await sitesResponse.json();
      const totalSites = sitesData.data?.sites?.length || 0;

      // Test agents endpoint to get total count
      const agentsResponse = await fetch(
        `${env.SENTINELONE_ENDPOINT}/web/api/v2.1/agents?limit=1`,
        {
          headers: {
            Authorization: `ApiToken ${env.SENTINELONE_API_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!agentsResponse.ok) {
        const errorText = await agentsResponse.text();
        throw new Error(
          `Agents API Error: ${agentsResponse.status} ${agentsResponse.statusText} - ${errorText}`,
        );
      }

      const agentsData = await agentsResponse.json();
      const totalAgents = agentsData.pagination?.totalItems || 0;

      console.log(
        `✅ Connection successful: ${totalSites} sites, ${totalAgents} agents`,
      );

      return {
        success: true,
        message: "SentinelOne connection successful",
        endpoint: env.SENTINELONE_ENDPOINT,
        details: {
          totalSites,
          totalAgents,
          sampleSite: sitesData.data?.sites?.[0]?.name || "None found",
          apiVersion: "v2.1",
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("❌ SentinelOne connection test failed:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        endpoint: env.SENTINELONE_ENDPOINT,
        details: {
          timestamp: new Date().toISOString(),
        },
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

  // **STEP 2: Enhanced agent sync with progress tracking**
  syncAgents: adminProcedure.mutation(async ({ ctx }) => {
    if (!env.SENTINELONE_API_KEY || !env.SENTINELONE_ENDPOINT) {
      throw new Error("SentinelOne configuration missing.");
    }

    const agentService = new EnhancedSentinelOneService(
      env.SENTINELONE_API_KEY,
      env.SENTINELONE_ENDPOINT,
      ctx.db,
    );

    console.log(`🚀 Starting enhanced agent sync...`);

    // Enhanced sync with progress tracking
    const result = await agentService.syncAgentsWithSiteMapping((progress) => {
      console.log(
        `📊 Progress: Page ${progress.currentPage}, Processed: ${progress.totalProcessed}`,
      );
    });

    console.log(`✅ Enhanced agent sync completed:`, {
      processed: result.processed,
      totalAvailable: result.totalAvailable,
      coverage: `${Math.round((result.processed / result.totalAvailable) * 100)}%`,
      duration: `${Math.round(result.syncDetails.durationMs / 1000)}s`,
    });

    return result;
  }),

  // **STEP 3: Get all agents including inactive (if needed)**
  syncAllAgentsIncludingInactive: adminProcedure.mutation(async ({ ctx }) => {
    if (!env.SENTINELONE_API_KEY || !env.SENTINELONE_ENDPOINT) {
      throw new Error("SentinelOne configuration missing.");
    }

    const agentService = new EnhancedSentinelOneService(
      env.SENTINELONE_API_KEY,
      env.SENTINELONE_ENDPOINT,
      ctx.db,
    );

    console.log(`🔄 Starting complete agent sync (including inactive)...`);
    const result = await agentService.syncAllAgentsIncludingInactive();
    console.log(`✅ Complete sync finished:`, result);

    return result;
  }),

  // **FULL SYNC: Enhanced version with better feedback**
  fullSync: adminProcedure.mutation(async ({ ctx }) => {
    if (!env.SENTINELONE_API_KEY || !env.SENTINELONE_ENDPOINT) {
      throw new Error("SentinelOne configuration missing.");
    }

    const startTime = new Date();
    console.log(`🚀 Starting enhanced full sync at ${startTime.toISOString()}`);

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
    console.log(`🏢 Phase 1: Syncing tenants from SentinelOne sites...`);
    const tenantResult = await tenantService.syncTenantsFromSentinelOneSites();
    console.log(
      `✅ Tenant sync: ${tenantResult.created} created, ${tenantResult.updated} updated`,
    );

    // Brief pause between phases
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Step 2: Enhanced agent sync
    console.log(`🚀 Phase 2: Syncing all agents with enhanced tracking...`);
    const agentResult = await agentService.syncAgentsWithSiteMapping(
      (progress) => {
        console.log(
          `📊 Agent sync progress: ${progress.totalProcessed}/${progress.estimatedTotal || "?"} (Page ${progress.currentPage})`,
        );
      },
    );

    const endTime = new Date();
    const totalDuration = endTime.getTime() - startTime.getTime();

    console.log(
      `🎉 Enhanced full sync completed in ${Math.round(totalDuration / 1000)}s:`,
      {
        tenants: `${tenantResult.created} created, ${tenantResult.updated} updated`,
        agents: `${agentResult.processed}/${agentResult.totalAvailable} processed`,
        coverage: `${Math.round((agentResult.processed / agentResult.totalAvailable) * 100)}%`,
        tenantsWithData: Object.keys(agentResult.tenantBreakdown).length,
      },
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
        agentsAvailable: agentResult.totalAvailable,
        coveragePercentage: Math.round(
          (agentResult.processed / agentResult.totalAvailable) * 100,
        ),
        tenantsWithData: Object.keys(agentResult.tenantBreakdown).length,
        totalDurationMs: totalDuration,
        avgTimePerAgent: agentResult.syncDetails.avgProcessingTimePerAgent,
      },
      performance: {
        startTime,
        endTime,
        totalDurationMs: totalDuration,
        tenantSyncTimeMs:
          agentResult.syncDetails.startTime.getTime() - startTime.getTime(),
        agentSyncTimeMs: agentResult.syncDetails.durationMs,
      },
    };
  }),

  // **Enhanced diagnostics endpoint**
  getDiagnostics: adminProcedure.query(async ({ ctx }) => {
    if (!env.SENTINELONE_API_KEY || !env.SENTINELONE_ENDPOINT) {
      throw new Error("SentinelOne configuration missing.");
    }

    try {
      // Get current database state
      const tenants = await ctx.db.tenant.findMany({
        where: { sentinelOneSiteId: { not: null } },
        include: {
          _count: {
            select: { endpoints: true },
          },
        },
      });

      const totalEndpoints = await ctx.db.endpoint.count();
      const sentinelOneEndpoints = await ctx.db.endpoint.count({
        where: { sentinelOneAgentId: { not: null } },
      });

      // Test API connectivity
      const apiTest = await fetch(
        `${env.SENTINELONE_ENDPOINT}/web/api/v2.1/agents?limit=1`,
        {
          headers: {
            Authorization: `ApiToken ${env.SENTINELONE_API_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      const apiData = apiTest.ok ? await apiTest.json() : null;
      const apiTotalAgents = apiData?.pagination?.totalItems || 0;

      // Calculate coverage
      const coverage =
        apiTotalAgents > 0 ? (sentinelOneEndpoints / apiTotalAgents) * 100 : 0;

      return {
        timestamp: new Date().toISOString(),
        database: {
          totalTenants: tenants.length,
          sentinelOneTenants: tenants.length,
          totalEndpoints,
          sentinelOneEndpoints,
          endpointsPerTenant: tenants.map((t) => ({
            name: t.name,
            slug: t.slug,
            siteId: t.sentinelOneSiteId,
            endpointCount: t._count.endpoints,
          })),
        },
        api: {
          endpoint: env.SENTINELONE_ENDPOINT,
          connected: apiTest.ok,
          totalAgentsAvailable: apiTotalAgents,
          status: apiTest.status,
        },
        analysis: {
          coveragePercentage: Math.round(coverage),
          missingAgents: Math.max(0, apiTotalAgents - sentinelOneEndpoints),
          recommendations: [
            coverage < 80 && "Run full agent sync to improve coverage",
            tenants.length === 0 && "Run tenant sync first",
            !apiTest.ok && "Check SentinelOne API connectivity",
          ].filter(Boolean),
        },
      };
    } catch (error) {
      throw new Error(
        `Diagnostics failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }),

  // Get site-to-tenant mapping with enhanced details
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

    // Get enhanced tenant details
    const tenantDetails = await ctx.db.tenant.findMany({
      where: {
        sentinelOneSiteId: { not: null },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        sentinelOneSiteId: true,
        createdAt: true,
        _count: {
          select: {
            endpoints: true,
            users: true,
            clients: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return {
      mappingCount: Object.keys(mapping).length,
      tenants: tenantDetails,
      rawMapping: mapping,
      summary: {
        totalTenants: tenantDetails.length,
        totalEndpoints: tenantDetails.reduce(
          (sum, t) => sum + t._count.endpoints,
          0,
        ),
        avgEndpointsPerTenant:
          tenantDetails.length > 0
            ? Math.round(
                tenantDetails.reduce((sum, t) => sum + t._count.endpoints, 0) /
                  tenantDetails.length,
              )
            : 0,
      },
    };
  }),

  // Get multi-source endpoint summary (existing but enhanced)
  getMultiSourceSummary: tenantProcedure
    .input(z.object({ tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

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
        take: 100, // Increased limit
        orderBy: { lastSeen: "desc" },
      });

      // Enhanced source analytics
      const sourceStats = {
        SENTINELONE: 0,
        NINJAONE: 0,
        PROOFPOINT: 0,
        multiSource: 0,
        noSource: 0,
      };

      const complianceStats = {
        compliant: 0,
        nonCompliant: 0,
        unknown: 0,
      };

      const endpointSummary = endpoints.map((endpoint) => {
        const sources = endpoint.endpointSources.map((es) => es.sourceType);
        const primarySource =
          endpoint.endpointSources.find((es) => es.isPrimary)?.sourceType ||
          sources[0] ||
          "NONE";

        // Count source usage
        if (sources.length === 0) {
          sourceStats.noSource++;
        } else {
          sources.forEach((source) => {
            if (sourceStats[source as keyof typeof sourceStats] !== undefined) {
              sourceStats[source as keyof typeof sourceStats]++;
            }
          });
        }

        if (sources.length > 1) {
          sourceStats.multiSource++;
        }

        // Count compliance
        if (endpoint.isCompliant === true) {
          complianceStats.compliant++;
        } else if (endpoint.isCompliant === false) {
          complianceStats.nonCompliant++;
        } else {
          complianceStats.unknown++;
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
          operatingSystem: endpoint.operatingSystem,
          criticalVulns: endpoint.criticalVulns,
          highVulns: endpoint.highVulns,
        };
      });

      return {
        totalEndpoints: endpoints.length,
        sourceStats,
        complianceStats,
        endpoints: endpointSummary,
        summary: {
          avgComplianceScore:
            endpoints.length > 0
              ? Math.round(
                  endpoints.reduce(
                    (sum, e) => sum + (e.complianceScore || 0),
                    0,
                  ) / endpoints.length,
                )
              : 0,
          totalVulnerabilities: endpoints.reduce(
            (sum, e) => sum + (e.criticalVulns || 0) + (e.highVulns || 0),
            0,
          ),
          lastSyncTime: endpoints[0]?.updatedAt || null,
        },
      };
    }),

  // Enhanced sync status with performance metrics
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
        take: 20, // More history
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

      const failedJobs = syncJobs.filter((job) => job.status === "FAILED");

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

      const successRate =
        syncJobs.length > 0
          ? (completedJobs.length / syncJobs.length) * 100
          : 0;

      return {
        latestJobs: latestByStatus,
        recentJobs: syncJobs.slice(0, 10),
        statistics: {
          totalJobs: syncJobs.length,
          completedJobs: completedJobs.length,
          failedJobs: failedJobs.length,
          runningJobs: syncJobs.filter((job) => job.status === "RUNNING")
            .length,
          successRate: Math.round(successRate),
          averageProcessingTimeMs: Math.round(avgProcessingTime),
          averageProcessingTimeMinutes: Math.round(avgProcessingTime / 60000),
          lastSyncTime: syncJobs[0]?.startedAt || null,
          totalRecordsProcessed: completedJobs.reduce(
            (sum, job) => sum + job.recordsProcessed,
            0,
          ),
        },
        performance: {
          averageDurationMinutes: Math.round(avgProcessingTime / 60000),
          fastestSync:
            completedJobs.length > 0
              ? Math.min(
                  ...completedJobs.map((job) =>
                    job.completedAt && job.startedAt
                      ? job.completedAt.getTime() - job.startedAt.getTime()
                      : Infinity,
                  ),
                ) / 60000
              : 0,
          slowestSync:
            completedJobs.length > 0
              ? Math.max(
                  ...completedJobs.map((job) =>
                    job.completedAt && job.startedAt
                      ? job.completedAt.getTime() - job.startedAt.getTime()
                      : 0,
                  ),
                ) / 60000
              : 0,
        },
      };
    }),
});
