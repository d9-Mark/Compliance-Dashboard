// src/server/api/routers/tenant.ts - Enhanced with Windows version tracking

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
        where: filter,
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
});
