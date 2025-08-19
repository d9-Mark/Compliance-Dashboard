// src/server/api/routers/tenant.ts - Enhanced with delete functionality

import { TRPCError } from "@trpc/server";
import z from "zod";
import {
  createTRPCRouter,
  adminProcedure,
  tenantProcedure,
  getTenantFilter,
} from "../trpc";

export const tenantRouter = createTRPCRouter({
  // ============================================================================
  // ADMIN-ONLY PROCEDURES (D9 admins)
  // ============================================================================

  /**
   * Get all tenants - admin only
   */
  getAll: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.tenant.findMany({
      include: {
        _count: {
          select: {
            users: true,
            clients: true,
            endpoints: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }),

  /**
   * Create a new tenant - admin only
   */
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        slug: z
          .string()
          .min(1)
          .regex(
            /^[a-z0-9-]+$/,
            "Slug must be lowercase alphanumeric with hyphens",
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if slug already exists
      const existing = await ctx.db.tenant.findUnique({
        where: { slug: input.slug },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Tenant slug already exists",
        });
      }

      return ctx.db.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
        },
      });
    }),

  /**
   * DELETE TENANT - admin only (NEW)
   */
  delete: adminProcedure
    .input(
      z.object({
        tenantId: z.string(),
        confirmSlug: z.string(), // Safety check - must type the slug to confirm
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get tenant details first
      const tenant = await ctx.db.tenant.findUnique({
        where: { id: input.tenantId },
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

      if (!tenant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tenant not found",
        });
      }

      // Safety check - must type the exact slug to confirm deletion
      if (tenant.slug !== input.confirmSlug) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `To delete this tenant, you must type the exact slug: "${tenant.slug}"`,
        });
      }

      // Prevent deletion of tenants with SentinelOne data (unless explicitly forced)
      if (tenant.sentinelOneSiteId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Cannot delete tenant linked to SentinelOne site. Use force delete if needed.",
        });
      }

      // Delete the tenant (cascade will handle related records)
      await ctx.db.tenant.delete({
        where: { id: input.tenantId },
      });

      return {
        success: true,
        deletedTenant: {
          name: tenant.name,
          slug: tenant.slug,
          hadUsers: tenant._count.users,
          hadClients: tenant._count.clients,
          hadEndpoints: tenant._count.endpoints,
        },
      };
    }),

  /**
   * FORCE DELETE TENANT - admin only (even SentinelOne-linked ones)
   */
  forceDelete: adminProcedure
    .input(
      z.object({
        tenantId: z.string(),
        confirmSlug: z.string(),
        forceConfirmation: z.literal("I UNDERSTAND THIS WILL DELETE ALL DATA"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await ctx.db.tenant.findUnique({
        where: { id: input.tenantId },
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

      if (!tenant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tenant not found",
        });
      }

      if (tenant.slug !== input.confirmSlug) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `To delete this tenant, you must type the exact slug: "${tenant.slug}"`,
        });
      }

      // Delete the tenant (cascade will handle all related records)
      await ctx.db.tenant.delete({
        where: { id: input.tenantId },
      });

      return {
        success: true,
        deletedTenant: {
          name: tenant.name,
          slug: tenant.slug,
          wasSentinelOneLinked: !!tenant.sentinelOneSiteId,
          hadUsers: tenant._count.users,
          hadClients: tenant._count.clients,
          hadEndpoints: tenant._count.endpoints,
        },
      };
    }),

  /**
   * Get tenants by type (test vs real)
   */
  getTenantsByType: adminProcedure.query(async ({ ctx }) => {
    const allTenants = await ctx.db.tenant.findMany({
      include: {
        endpoints: {
          select: {
            id: true,
            hostname: true,
            windowsCompliant: true,
            windowsComplianceScore: true,
            activeThreats: true,
            criticalVulns: true,
            highVulns: true,
            mediumVulns: true,
            lowVulns: true,
            lastWindowsCheck: true,
            isCompliant: true,
            complianceScore: true,
          },
        },
        _count: {
          select: {
            users: true,
            clients: true,
            endpoints: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const testTenants = allTenants.filter(
      (t) =>
        !t.sentinelOneSiteId &&
        (t.slug.includes("acme") ||
          t.slug.includes("tech-solutions") ||
          t.slug.includes("global-enterprises")),
    );

    const sentinelOneTenants = allTenants.filter((t) => t.sentinelOneSiteId);
    const otherTenants = allTenants.filter(
      (t) =>
        !t.sentinelOneSiteId && !testTenants.some((test) => test.id === t.id),
    );

    return {
      all: allTenants,
      test: testTenants,
      sentinelOne: sentinelOneTenants,
      other: otherTenants,
      summary: {
        total: allTenants.length,
        testCount: testTenants.length,
        sentinelOneCount: sentinelOneTenants.length,
        otherCount: otherTenants.length,
      },
    };
  }),

  // ============================================================================
  // EXISTING PROCEDURES (unchanged)
  // ============================================================================

  /**
   * Get tenant overview with stats - ENHANCED with Windows version data
   */
  getOverview: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().optional(), // Only required for admin users
      }),
    )
    .query(async ({ ctx, input }) => {
      // For tenant queries, we need to use 'id' not 'tenantId'
      let tenantId: string;

      if (ctx.isAdmin) {
        if (!input.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Admin users must specify tenantId",
          });
        }
        tenantId = input.tenantId;
      } else {
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "User not assigned to a tenant",
          });
        }
        tenantId = ctx.tenantId;
      }

      const tenant = await ctx.db.tenant.findFirst({
        where: { id: tenantId },
        include: {
          clients: {
            include: {
              _count: {
                select: { endpoints: true },
              },
            },
          },
          _count: {
            select: {
              users: true,
              endpoints: true,
            },
          },
        },
      });

      if (!tenant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tenant not found",
        });
      }

      // Get endpoint stats
      const endpointStats = await ctx.db.endpoint.groupBy({
        by: ["isCompliant"],
        where: { tenantId },
        _count: {
          id: true,
        },
      });

      // Get vulnerability stats
      const vulnStats = await ctx.db.endpoint.aggregate({
        where: { tenantId },
        _sum: {
          criticalVulns: true,
          highVulns: true,
          mediumVulns: true,
          lowVulns: true,
        },
      });

      // NEW: Get Windows version breakdown
      const windowsVersionStats = await ctx.db.endpoint.groupBy({
        by: ["operatingSystem", "osVersion"],
        where: {
          tenantId,
          operatingSystem: {
            contains: "Windows",
            mode: "insensitive",
          },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: "desc",
          },
        },
      });

      // NEW: Analyze Windows compliance
      const windowsEndpoints = await ctx.db.endpoint.findMany({
        where: {
          tenantId,
          operatingSystem: {
            contains: "Windows",
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          operatingSystem: true,
          osVersion: true,
          lastSeen: true,
        },
      });

      // Define latest Windows versions (this could come from a database table later)
      const latestWindowsVersions = {
        "Windows 11": ["10.0.22631", "10.0.22621"], // 23H2, 22H2
        "Windows 10": ["10.0.19045"], // 22H2 (final version)
        "Windows Server 2022": ["10.0.20348"],
        "Windows Server 2019": ["10.0.17763"],
      };

      // Analyze Windows version compliance
      let windowsCompliantCount = 0;
      let windowsOutdatedCount = 0;
      let windowsUnknownCount = 0;

      const windowsVersionBreakdown = windowsVersionStats.map((stat) => {
        const isLatest = Object.entries(latestWindowsVersions).some(
          ([os, versions]) => {
            return (
              stat.operatingSystem?.includes(os.split(" ")[1]) &&
              versions.includes(stat.osVersion || "")
            );
          },
        );

        if (isLatest) {
          windowsCompliantCount += stat._count.id;
        } else if (stat.osVersion) {
          windowsOutdatedCount += stat._count.id;
        } else {
          windowsUnknownCount += stat._count.id;
        }

        return {
          operatingSystem: stat.operatingSystem,
          osVersion: stat.osVersion,
          count: stat._count.id,
          isLatest,
          displayName: `${stat.operatingSystem} ${stat.osVersion || "Unknown"}`,
        };
      });

      // NEW: Get endpoints that haven't been seen recently
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const staleEndpointsCount = await ctx.db.endpoint.count({
        where: {
          tenantId,
          lastSeen: {
            lt: thirtyDaysAgo,
          },
        },
      });

      return {
        tenant,
        stats: {
          endpoints: {
            total: tenant._count.endpoints,
            compliant: endpointStats.find((s) => s.isCompliant)?._count.id ?? 0,
            nonCompliant:
              endpointStats.find((s) => !s.isCompliant)?._count.id ?? 0,
            stale: staleEndpointsCount,
          },
          vulnerabilities: {
            critical: vulnStats._sum.criticalVulns ?? 0,
            high: vulnStats._sum.highVulns ?? 0,
            medium: vulnStats._sum.mediumVulns ?? 0,
            low: vulnStats._sum.lowVulns ?? 0,
          },
          // NEW: Windows-specific stats
          windows: {
            total: windowsEndpoints.length,
            compliant: windowsCompliantCount,
            outdated: windowsOutdatedCount,
            unknown: windowsUnknownCount,
            versions: windowsVersionBreakdown,
          },
        },
      };
    }),

  // ============================================================================
  // ENDPOINT MANAGEMENT - ENHANCED with Windows version details
  // ============================================================================

  /**
   * Get endpoints for a tenant - ENHANCED with Windows version grouping
   */
  getEndpoints: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
        clientId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
        complianceFilter: z
          .enum(["all", "compliant", "non-compliant"])
          .default("all"),
        // NEW: Windows-specific filters
        windowsFilter: z
          .enum(["all", "latest", "outdated", "unknown"])
          .default("all"),
        osFilter: z.string().optional(), // Filter by specific OS
      }),
    )
    .query(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

      // Build where clause with Windows filtering
      const where: any = {
        ...filter,
        ...(input.clientId && { clientId: input.clientId }),
        ...(input.search && {
          hostname: {
            contains: input.search,
            mode: "insensitive",
          },
        }),
        ...(input.complianceFilter !== "all" && {
          isCompliant: input.complianceFilter === "compliant",
        }),
        ...(input.osFilter && {
          operatingSystem: {
            contains: input.osFilter,
            mode: "insensitive",
          },
        }),
      };

      // Apply Windows version filtering
      if (input.windowsFilter !== "all") {
        const latestVersions = [
          "10.0.22631",
          "10.0.22621",
          "10.0.20348",
          "10.0.19045",
        ];

        switch (input.windowsFilter) {
          case "latest":
            where.osVersion = { in: latestVersions };
            break;
          case "outdated":
            where.AND = [
              { osVersion: { notIn: latestVersions } },
              { osVersion: { not: null } },
            ];
            break;
          case "unknown":
            where.osVersion = null;
            break;
        }
      }

      const [endpoints, total] = await Promise.all([
        ctx.db.endpoint.findMany({
          where,
          include: {
            client: {
              select: { id: true, name: true },
            },
            _count: {
              select: {
                vulnerabilities: true,
                complianceChecks: true,
              },
            },
          },
          orderBy: [{ lastSeen: "desc" }, { hostname: "asc" }],
          take: input.limit,
          skip: input.offset,
        }),
        ctx.db.endpoint.count({ where }),
      ]);

      // NEW: Enhance endpoints with Windows compliance analysis
      const enhancedEndpoints = endpoints.map((endpoint) => {
        const latestVersions = [
          "10.0.22631",
          "10.0.22621",
          "10.0.20348",
          "10.0.19045",
        ];
        const isWindowsLatest = endpoint.osVersion
          ? latestVersions.includes(endpoint.osVersion)
          : false;
        const isWindows =
          endpoint.operatingSystem?.toLowerCase().includes("windows") ?? false;

        // Calculate days since last seen
        const daysSinceLastSeen = endpoint.lastSeen
          ? Math.floor(
              (Date.now() - endpoint.lastSeen.getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null;

        return {
          ...endpoint,
          windows: {
            isWindows,
            isLatest: isWindowsLatest,
            needsUpdate: isWindows && !isWindowsLatest,
            daysSinceLastSeen,
            isStale: daysSinceLastSeen !== null && daysSinceLastSeen > 30,
          },
        };
      });

      return {
        endpoints: enhancedEndpoints,
        total,
        hasMore: total > input.offset + input.limit,
      };
    }),

  /**
   * Get single endpoint details - ENHANCED with Windows analysis
   */
  getEndpoint: tenantProcedure
    .input(
      z.object({
        endpointId: z.string(),
        tenantId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

      const endpoint = await ctx.db.endpoint.findFirst({
        where: {
          id: input.endpointId,
          ...filter,
        },
        include: {
          client: true,
          vulnerabilities: {
            include: {
              vulnerability: true,
            },
            orderBy: { detectedAt: "desc" },
          },
          complianceChecks: {
            include: {
              framework: true,
            },
            orderBy: { lastChecked: "desc" },
          },
        },
      });

      if (!endpoint) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Endpoint not found",
        });
      }

      return endpoint;
    }),

  // ============================================================================
  // NEW: Windows-specific queries
  // ============================================================================

  /**
   * Get Windows version summary for a tenant
   */
  getWindowsVersionSummary: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

      // Get all Windows endpoints with version details
      const windowsEndpoints = await ctx.db.endpoint.findMany({
        where: {
          ...filter,
          operatingSystem: {
            contains: "Windows",
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          hostname: true,
          operatingSystem: true,
          osVersion: true,
          lastSeen: true,
          isCompliant: true,
          client: {
            select: { name: true },
          },
        },
        orderBy: { hostname: "asc" },
      });

      // Define what constitutes "latest" versions
      const latestVersionMap = {
        "Windows 11": ["10.0.22631", "10.0.22621"], // 23H2, 22H2
        "Windows 10": ["10.0.19045"], // 22H2 (final)
        "Windows Server 2022": ["10.0.20348"],
        "Windows Server 2019": ["10.0.17763"],
      };

      // Analyze each endpoint
      const analysisResults = windowsEndpoints.map((endpoint) => {
        const isLatest = Object.entries(latestVersionMap).some(
          ([os, versions]) => {
            return (
              endpoint.operatingSystem?.includes(os.split(" ")[1]) &&
              versions.includes(endpoint.osVersion || "")
            );
          },
        );

        const recommendedVersion = Object.entries(latestVersionMap).find(
          ([os]) => endpoint.operatingSystem?.includes(os.split(" ")[1]),
        )?.[1][0];

        return {
          ...endpoint,
          analysis: {
            isLatest,
            needsUpdate: !isLatest && endpoint.osVersion,
            recommendedVersion,
            daysSinceLastSeen: endpoint.lastSeen
              ? Math.floor(
                  (Date.now() - endpoint.lastSeen.getTime()) /
                    (1000 * 60 * 60 * 24),
                )
              : null,
          },
        };
      });

      return {
        endpoints: analysisResults,
        summary: {
          total: windowsEndpoints.length,
          latest: analysisResults.filter((e) => e.analysis.isLatest).length,
          needsUpdate: analysisResults.filter((e) => e.analysis.needsUpdate)
            .length,
          unknown: analysisResults.filter((e) => !e.osVersion).length,
        },
      };
    }),

  // ============================================================================
  // CLIENT MANAGEMENT (unchanged)
  // ============================================================================

  getClients: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

      return ctx.db.client.findMany({
        where: filter,
        include: {
          _count: {
            select: { endpoints: true },
          },
        },
        orderBy: { name: "asc" },
      });
    }),

  createClient: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1),
        tenantId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

      return ctx.db.client.create({
        data: {
          name: input.name,
          tenantId: filter.tenantId,
        },
      });
    }),

  // ============================================================================
  // SYNC STATUS (unchanged)
  // ============================================================================

  getSyncStatus: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
      }),
    )
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

      const latestBySource = syncJobs.reduce(
        (acc, job) => {
          if (!acc[job.source] || acc[job.source].startedAt < job.startedAt) {
            acc[job.source] = job;
          }
          return acc;
        },
        {} as Record<string, (typeof syncJobs)[0]>,
      );

      return {
        syncJobs: latestBySource,
        recentJobs: syncJobs.slice(0, 5),
      };
    }),

  /**
   * Get global compliance statistics - ADMIN ONLY
   * This provides the data needed for the admin dashboard overview
   */
  getGlobalStats: adminProcedure.query(async ({ ctx }) => {
    // Get all endpoint compliance stats grouped by tenant
    const endpointStats = await ctx.db.endpoint.groupBy({
      by: ["tenantId", "isCompliant"],
      _count: { id: true },
    });

    // Get all tenants for reference
    const tenants = await ctx.db.tenant.findMany({
      select: { id: true, name: true, slug: true },
    });

    // Process stats by tenant
    const tenantStats = new Map();

    // Initialize all tenants with zero stats
    tenants.forEach((tenant) => {
      tenantStats.set(tenant.id, {
        ...tenant,
        totalEndpoints: 0,
        compliantEndpoints: 0,
        nonCompliantEndpoints: 0,
        complianceRate: 0,
      });
    });

    // Add actual endpoint counts
    endpointStats.forEach((stat) => {
      const tenant = tenantStats.get(stat.tenantId);
      if (tenant) {
        tenant.totalEndpoints += stat._count.id;
        if (stat.isCompliant) {
          tenant.compliantEndpoints += stat._count.id;
        } else {
          tenant.nonCompliantEndpoints += stat._count.id;
        }
      }
    });

    // Calculate compliance rates
    const tenantList = Array.from(tenantStats.values()).map((tenant) => ({
      ...tenant,
      complianceRate:
        tenant.totalEndpoints > 0
          ? Math.round(
              (tenant.compliantEndpoints / tenant.totalEndpoints) * 100,
            )
          : 0,
    }));

    // Calculate global totals
    const globalTotals = tenantList.reduce(
      (acc, tenant) => ({
        totalTenants: acc.totalTenants + 1,
        totalEndpoints: acc.totalEndpoints + tenant.totalEndpoints,
        totalCompliant: acc.totalCompliant + tenant.compliantEndpoints,
        totalNonCompliant: acc.totalNonCompliant + tenant.nonCompliantEndpoints,
      }),
      {
        totalTenants: 0,
        totalEndpoints: 0,
        totalCompliant: 0,
        totalNonCompliant: 0,
      },
    );

    const globalComplianceRate =
      globalTotals.totalEndpoints > 0
        ? Math.round(
            (globalTotals.totalCompliant / globalTotals.totalEndpoints) * 100,
          )
        : 0;

    return {
      global: {
        ...globalTotals,
        averageCompliance: globalComplianceRate,
      },
      tenants: tenantList,
    };
  }),

  /**
   * Get vulnerability trends for a tenant - NEW ENDPOINT
   */
  getVulnerabilityTrends: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
        days: z.number().min(7).max(90).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      try {
        // Get vulnerability detection trends
        const vulnerabilityDetections =
          await ctx.db.endpointVulnerability.groupBy({
            by: ["detectedAt"],
            where: {
              endpoint: filter,
              detectedAt: { gte: startDate },
              status: "OPEN",
            },
            _count: {
              id: true,
            },
            orderBy: {
              detectedAt: "asc",
            },
          });

        // Get resolution trends
        const vulnerabilityResolutions =
          await ctx.db.endpointVulnerability.groupBy({
            by: ["resolvedAt"],
            where: {
              endpoint: filter,
              resolvedAt: { gte: startDate },
              status: "RESOLVED",
            },
            _count: {
              id: true,
            },
            orderBy: {
              resolvedAt: "asc",
            },
          });

        // Process data into daily buckets
        const dailyData = [];
        for (let i = 0; i < input.days; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          const dateStr = date.toISOString().split("T")[0];

          const detected = vulnerabilityDetections
            .filter((v) => v.detectedAt.toISOString().split("T")[0] === dateStr)
            .reduce((sum, v) => sum + v._count.id, 0);

          const resolved = vulnerabilityResolutions
            .filter(
              (v) =>
                v.resolvedAt &&
                v.resolvedAt.toISOString().split("T")[0] === dateStr,
            )
            .reduce((sum, v) => sum + v._count.id, 0);

          dailyData.push({
            date: dateStr,
            detected,
            resolved,
            net: detected - resolved,
          });
        }

        return {
          trends: dailyData,
          summary: {
            totalDetected: dailyData.reduce((sum, d) => sum + d.detected, 0),
            totalResolved: dailyData.reduce((sum, d) => sum + d.resolved, 0),
            netChange: dailyData.reduce((sum, d) => sum + d.net, 0),
          },
        };
      } catch (error) {
        console.error("Error fetching vulnerability trends:", error);
        return {
          trends: [],
          summary: {
            totalDetected: 0,
            totalResolved: 0,
            netChange: 0,
          },
        };
      }
    }),

  /**
   * Get detailed critical vulnerabilities by endpoint - NEW ENHANCED ENDPOINT
   */
  getCriticalVulnerabilityDetails: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
        severityFilter: z
          .enum(["CRITICAL", "HIGH", "CRITICAL_AND_HIGH"])
          .default("CRITICAL_AND_HIGH"),
        hideD9Managed: z.boolean().default(false), // Admin can filter out D9-managed apps
      }),
    )
    .query(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

      // Build severity filter
      const severityCondition =
        input.severityFilter === "CRITICAL_AND_HIGH"
          ? ["CRITICAL", "HIGH"]
          : [input.severityFilter];

      // Get D9 managed apps list for admin filtering
      const d9ManagedApps =
        input.hideD9Managed && ctx.isAdmin
          ? [
              "Microsoft Edge",
              "Google Chrome",
              "Mozilla Firefox",
              "Adobe Acrobat",
              "Microsoft Office",
              "Zoom",
              "Teams",
              "OneDrive",
              // Add more D9-managed apps as needed
            ]
          : [];

      const endpoints = await ctx.db.endpoint.findMany({
        where: {
          ...filter,
          // Only endpoints with critical/high vulnerabilities
          vulnerabilities: {
            some: {
              status: "OPEN",
              vulnerability: {
                severity: { in: severityCondition },
                ...(d9ManagedApps.length > 0 && {
                  product: { notIn: d9ManagedApps },
                }),
              },
            },
          },
        },
        include: {
          client: {
            select: { id: true, name: true },
          },
          vulnerabilities: {
            where: {
              status: "OPEN",
              vulnerability: {
                severity: { in: severityCondition },
                ...(d9ManagedApps.length > 0 && {
                  product: { notIn: d9ManagedApps },
                }),
              },
            },
            include: {
              vulnerability: {
                select: {
                  id: true,
                  cveId: true,
                  title: true,
                  description: true,
                  severity: true,
                  cvssScore: true,
                  vendor: true,
                  product: true,
                  version: true,
                },
              },
            },
            orderBy: [
              { vulnerability: { severity: "desc" } },
              { detectedAt: "desc" },
            ],
          },
        },
        orderBy: [
          { criticalVulns: "desc" },
          { highVulns: "desc" },
          { hostname: "asc" },
        ],
      });

      // Transform data for easier consumption
      const endpointDetails = endpoints.map((endpoint) => {
        const vulnsByApp = endpoint.vulnerabilities.reduce(
          (acc, ev) => {
            const app = `${ev.vulnerability.vendor || "Unknown"} ${ev.vulnerability.product || "Unknown"}`;
            const version = ev.vulnerability.version || "Unknown Version";

            if (!acc[app]) {
              acc[app] = {
                appName: app,
                vendor: ev.vulnerability.vendor,
                product: ev.vulnerability.product,
                vulnerabilities: [],
                criticalCount: 0,
                highCount: 0,
                totalCount: 0,
              };
            }

            acc[app].vulnerabilities.push({
              id: ev.vulnerability.id,
              cveId: ev.vulnerability.cveId,
              title: ev.vulnerability.title,
              severity: ev.vulnerability.severity,
              cvssScore: ev.vulnerability.cvssScore,
              version: ev.vulnerability.version,
              detectedAt: ev.detectedAt,
            });

            if (ev.vulnerability.severity === "CRITICAL")
              acc[app].criticalCount++;
            if (ev.vulnerability.severity === "HIGH") acc[app].highCount++;
            acc[app].totalCount++;

            return acc;
          },
          {} as Record<string, any>,
        );

        return {
          endpoint: {
            id: endpoint.id,
            hostname: endpoint.hostname,
            operatingSystem: endpoint.operatingSystem,
            client: endpoint.client,
            criticalVulns: endpoint.criticalVulns,
            highVulns: endpoint.highVulns,
            lastSeen: endpoint.lastSeen,
          },
          vulnerableApps: Object.values(vulnsByApp),
          totalCritical: endpoint.vulnerabilities.filter(
            (v) => v.vulnerability.severity === "CRITICAL",
          ).length,
          totalHigh: endpoint.vulnerabilities.filter(
            (v) => v.vulnerability.severity === "HIGH",
          ).length,
          totalVulnerabilities: endpoint.vulnerabilities.length,
        };
      });

      // Summary statistics
      const summary = {
        totalEndpointsAffected: endpoints.length,
        totalCriticalVulns: endpointDetails.reduce(
          (sum, e) => sum + e.totalCritical,
          0,
        ),
        totalHighVulns: endpointDetails.reduce(
          (sum, e) => sum + e.totalHigh,
          0,
        ),
        mostVulnerableApps: Object.values(
          endpointDetails
            .flatMap((e) => e.vulnerableApps)
            .reduce(
              (acc, app) => {
                const key = app.appName;
                if (!acc[key]) {
                  acc[key] = {
                    appName: app.appName,
                    vendor: app.vendor,
                    product: app.product,
                    affectedEndpoints: new Set(),
                    criticalCount: 0,
                    highCount: 0,
                    totalCount: 0,
                  };
                }
                acc[key].affectedEndpoints.add(
                  endpointDetails.find((e) =>
                    e.vulnerableApps.some((va) => va.appName === app.appName),
                  )?.endpoint.id,
                );
                acc[key].criticalCount += app.criticalCount;
                acc[key].highCount += app.highCount;
                acc[key].totalCount += app.totalCount;
                return acc;
              },
              {} as Record<string, any>,
            ),
        )
          .map((app) => ({
            ...app,
            affectedEndpointsCount: app.affectedEndpoints.size,
            affectedEndpoints: undefined, // Remove the Set for JSON serialization
          }))
          .sort(
            (a, b) =>
              b.criticalCount - a.criticalCount || b.totalCount - a.totalCount,
          )
          .slice(0, 10),
      };

      return {
        endpoints: endpointDetails,
        summary,
        isFiltered: input.hideD9Managed && ctx.isAdmin,
        d9ManagedAppsHidden: d9ManagedApps.length,
      };
    }),

  /**
   * Get D9 managed apps - QUERY
   */
  getD9ManagedApps: adminProcedure.query(async ({ ctx }) => {
    const d9Apps = await ctx.db.application.findMany({
      where: {
        category: "D9_MANAGED",
      },
      select: {
        name: true,
        vendor: true,
        category: true,
      },
    });

    return { apps: d9Apps };
  }),

  /**
   * Admin-only: Manage D9 app exclusions - NEW ADMIN ENDPOINT
   */
  manageD9Apps: adminProcedure
    .input(
      z.object({
        action: z.enum(["GET", "ADD", "REMOVE"]),
        appName: z.string().optional(),
        vendor: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // This could be stored in a dedicated table, but for now using Application model
      // with a special flag or storing in a config table

      if (input.action === "GET") {
        // Return current D9 managed apps
        const d9Apps = await ctx.db.application.findMany({
          where: {
            category: "D9_MANAGED", // Use category field to mark D9 managed apps
          },
          select: {
            name: true,
            vendor: true,
            category: true,
          },
        });

        return { apps: d9Apps };
      }

      if (input.action === "ADD" && input.appName) {
        await ctx.db.application.upsert({
          where: {
            name_vendor: {
              name: input.appName,
              vendor: input.vendor || "Unknown",
            },
          },
          update: {
            category: "D9_MANAGED",
          },
          create: {
            name: input.appName,
            vendor: input.vendor || "Unknown",
            category: "D9_MANAGED",
            riskLevel: "LOW", // D9 managed apps are low risk
            isMonitored: false, // Don't alert on D9 managed apps
          },
        });

        return {
          success: true,
          message: `Added ${input.appName} to D9 managed apps`,
        };
      }

      if (input.action === "REMOVE" && input.appName) {
        await ctx.db.application.updateMany({
          where: {
            name: input.appName,
            vendor: input.vendor,
            category: "D9_MANAGED",
          },
          data: {
            category: "OTHER",
            isMonitored: true,
          },
        });

        return {
          success: true,
          message: `Removed ${input.appName} from D9 managed apps`,
        };
      }

      throw new Error("Invalid action or missing parameters");
    }),
});
