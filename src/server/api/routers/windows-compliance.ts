// src/server/api/routers/windows-compliance.ts
// Complete tRPC router for Windows compliance management

import { z } from "zod";
import {
  createTRPCRouter,
  adminProcedure,
  tenantProcedure,
  getTenantFilter,
} from "~/server/api/trpc";
import { WindowsVersionDetectionService } from "~/server/services/windows-version-detection";
import { EndOfLifeSyncService } from "~/server/services/endoflife-sync";

export const windowsComplianceRouter = createTRPCRouter({
  // ============================================================================
  // ADMIN-ONLY PROCEDURES
  // ============================================================================

  /**
   * Sync Windows versions from endoflife.date - ADMIN ONLY
   */
  syncWindowsVersions: adminProcedure.mutation(async ({ ctx }) => {
    const syncService = new EndOfLifeSyncService(ctx.db);
    return syncService.syncWindowsVersions();
  }),

  /**
   * Get compliance summary across all tenants - FIXED for operatingSystem field
   */
  getGlobalComplianceSummary: adminProcedure.query(async ({ ctx }) => {
    const syncService = new EndOfLifeSyncService(ctx.db);
    const versionSummary = await syncService.getComplianceSummary();

    // Get all tenants with their Windows endpoints and latest compliance evaluation
    const tenants = await ctx.db.tenant.findMany({
      include: {
        endpoints: {
          where: {
            operatingSystem: {
              // FIXED: Use operatingSystem instead of osName
              contains: "Windows",
              mode: "insensitive",
            },
          },
          include: {
            WindowsComplianceEvaluation: {
              orderBy: { evaluatedAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    // Calculate per-tenant compliance stats
    const tenantBreakdown = tenants.map((tenant) => {
      let compliant = 0;
      let nonCompliant = 0;

      tenant.endpoints.forEach((ep) => {
        // Prefer the stored boolean if available
        if (ep.windowsCompliant === true) compliant++;
        else if (ep.windowsCompliant === false) nonCompliant++;
        else {
          // Fallback to latest evaluation
          const latestEval = ep.WindowsComplianceEvaluation[0];
          if (latestEval) {
            if (latestEval.isCompliant) compliant++;
            else nonCompliant++;
          }
        }
      });

      const total = tenant.endpoints.length;
      const complianceRate =
        total > 0 ? Math.round((compliant / total) * 100) : 0;

      return {
        tenantId: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        total,
        compliant,
        nonCompliant,
        complianceRate,
      };
    });

    // Global totals
    const totalWindowsEndpoints = tenantBreakdown.reduce(
      (sum, t) => sum + t.total,
      0,
    );
    const totalCompliant = tenantBreakdown.reduce(
      (sum, t) => sum + t.compliant,
      0,
    );
    const totalNonCompliant = tenantBreakdown.reduce(
      (sum, t) => sum + t.nonCompliant,
      0,
    );

    return {
      versions: versionSummary,
      tenants: tenantBreakdown.length,
      totalWindowsEndpoints,
      complianceOverview: {
        compliant: totalCompliant,
        nonCompliant: totalNonCompliant,
        complianceRate:
          totalWindowsEndpoints > 0
            ? Math.round((totalCompliant / totalWindowsEndpoints) * 100)
            : 0,
      },
      tenantBreakdown,
    };
  }),

  /**
   * Get Windows version registry - ADMIN ONLY
   */
  getWindowsVersionRegistry: adminProcedure.query(async ({ ctx }) => {
    const versions = await ctx.db.windowsVersion.findMany({
      orderBy: [{ majorVersion: "desc" }, { releaseDate: "desc" }],
    });

    // Group by major version
    const grouped = versions.reduce(
      (acc, version) => {
        if (!acc[version.majorVersion]) {
          acc[version.majorVersion] = [];
        }
        acc[version.majorVersion].push(version);
        return acc;
      },
      {} as Record<string, typeof versions>,
    );

    return {
      versions,
      grouped,
      summary: {
        totalVersions: versions.length,
        supportedVersions: versions.filter((v) => v.isSupported).length,
        majorVersions: Object.keys(grouped).length,
      },
    };
  }),

  /**
   * Simple admin procedure - just check if Windows builds are current
   */
  updateWindowsCompliance: adminProcedure.mutation(async ({ ctx }) => {
    // Get latest supported builds for Windows 10 and 11
    const latestBuilds = await ctx.db.windowsVersion.findMany({
      where: {
        majorVersion: { in: ["10", "11"] },
        isSupported: true,
      },
      orderBy: [{ majorVersion: "desc" }, { releaseDate: "desc" }],
    });

    // Get the actual latest build for each major version
    const latestByVersion: Record<string, any> = {};
    for (const version of latestBuilds) {
      if (
        !latestByVersion[version.majorVersion] ||
        new Date(version.releaseDate) >
          new Date(latestByVersion[version.majorVersion].releaseDate)
      ) {
        latestByVersion[version.majorVersion] = version;
      }
    }

    // Get all Windows endpoints
    const endpoints = await ctx.db.endpoint.findMany({
      where: {
        OR: [
          { osName: { contains: "Windows", mode: "insensitive" } },
          { operatingSystem: { contains: "Windows", mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        hostname: true,
        tenantId: true,
        osName: true,
        osRevision: true,
        operatingSystem: true,
        osVersion: true,
      },
    });

    let processed = 0;
    let compliant = 0;
    let nonCompliant = 0;
    let errors = 0;

    for (const endpoint of endpoints) {
      try {
        // Determine Windows version (10 or 11)
        const osString = endpoint.osName || endpoint.operatingSystem || "";
        const versionMatch = osString.match(/Windows (\d+)/i);
        const majorVersion = versionMatch ? versionMatch[1] : null;

        if (!majorVersion || !["10", "11"].includes(majorVersion)) {
          errors++;
          continue;
        }

        // Get current build number from osRevision or osVersion
        const buildString = endpoint.osRevision || endpoint.osVersion || "";
        const currentBuildNumber = parseInt(
          buildString.split(".").pop() || "0",
          10,
        );

        if (!currentBuildNumber) {
          errors++;
          continue;
        }

        // Get latest available build for this version
        const latestForVersion = latestByVersion[majorVersion];
        if (!latestForVersion) {
          errors++;
          continue;
        }

        // Extract latest build number (e.g., "10.0.26100" → 26100)
        const latestBuildNumber = parseInt(
          latestForVersion.latestBuild.split(".").pop() || "0",
          10,
        );

        // Determine compliance
        const isCompliant = currentBuildNumber >= latestBuildNumber;
        const complianceScore = isCompliant
          ? 100
          : Math.max(
              0,
              100 - Math.floor((latestBuildNumber - currentBuildNumber) / 100),
            );

        // Update endpoint
        await ctx.db.endpoint.update({
          where: { id: endpoint.id },
          data: {
            windowsCompliant: isCompliant,
            windowsComplianceScore: complianceScore,
            lastWindowsCheck: new Date(),
          },
        });

        processed++;
        if (isCompliant) {
          compliant++;
        } else {
          nonCompliant++;
        }
      } catch (error) {
        console.error(`Failed to process ${endpoint.hostname}:`, error);
        errors++;
      }
    }

    return {
      processed,
      compliant,
      nonCompliant,
      errors,
      complianceRate:
        processed > 0 ? Math.round((compliant / processed) * 100) : 0,
      latestBuilds: latestByVersion,
    };
  }),

  /**
   * Get all Windows compliance policies - ADMIN ONLY
   */
  getAllCompliancePolicies: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.windowsCompliancePolicy.findMany({
      include: {
        tenant: {
          select: { name: true, slug: true },
        },
        _count: {
          select: {
            WindowsComplianceEvaluation: true,
          },
        },
      },
      orderBy: [{ tenant: { name: "asc" } }, { name: "asc" }],
    });
  }),

  // ============================================================================
  // TENANT-SCOPED PROCEDURES
  // ============================================================================

  /**
   * Get Windows compliance overview for a tenant - FIXED for operatingSystem field
   */
  getComplianceOverview: tenantProcedure
    .input(z.object({ tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

      // Get latest evaluations for each Windows endpoint - FIXED field name
      const endpoints = await ctx.db.endpoint.findMany({
        where: {
          ...filter,
          operatingSystem: {
            // FIXED: Use operatingSystem instead of osName
            contains: "Windows",
            mode: "insensitive",
          },
        },
        include: {
          WindowsComplianceEvaluation: {
            orderBy: { evaluatedAt: "desc" },
            take: 1,
          },
        },
      });

      const summary = {
        totalEndpoints: endpoints.length,
        compliant: 0,
        nonCompliant: 0,
        notEvaluated: 0,
        averageScore: 0,
      };

      let totalScore = 0;
      let evaluatedCount = 0;

      endpoints.forEach((endpoint) => {
        const latestEval = endpoint.WindowsComplianceEvaluation[0];
        if (latestEval) {
          if (latestEval.isCompliant) {
            summary.compliant++;
          } else {
            summary.nonCompliant++;
          }
          totalScore += latestEval.complianceScore;
          evaluatedCount++;
        } else {
          summary.notEvaluated++;
        }
      });

      summary.averageScore =
        evaluatedCount > 0 ? Math.round(totalScore / evaluatedCount) : 0;

      return {
        summary,
        endpoints: endpoints.map((e) => ({
          id: e.id,
          hostname: e.hostname,
          operatingSystem: e.operatingSystem, // FIXED: Use operatingSystem
          osVersion: e.osVersion, // FIXED: Use osVersion
          lastEvaluation: e.WindowsComplianceEvaluation[0] || null,
        })),
      };
    }),

  /**
   * Get compliance policy for tenant
   */
  getCompliancePolicy: tenantProcedure
    .input(z.object({ tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

      return ctx.db.windowsCompliancePolicy.findFirst({
        where: {
          tenantId: filter.tenantId,
          isActive: true,
        },
        orderBy: { priority: "asc" },
      });
    }),

  /**
   * Update compliance policy
   */
  updateCompliancePolicy: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
        policyId: z.string(),
        updates: z.object({
          name: z.string().optional(),
          description: z.string().optional(),
          requireSupported: z.boolean().optional(),
          requireLatestBuild: z.boolean().optional(),
          allowedVersions: z.array(z.string()).optional(),
          maxBuildAgeDays: z.number().nullable().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

      // Verify policy belongs to the tenant
      const policy = await ctx.db.windowsCompliancePolicy.findFirst({
        where: {
          id: input.policyId,
          tenantId: filter.tenantId,
        },
      });

      if (!policy) {
        throw new Error("Compliance policy not found or access denied");
      }

      return ctx.db.windowsCompliancePolicy.update({
        where: { id: input.policyId },
        data: {
          ...input.updates,
          lastModified: new Date(),
          modifiedBy: ctx.user.email || ctx.user.id,
        },
      });
    }),

  /**
   * Trigger compliance evaluation for specific endpoints - FIXED for operatingSystem field
   */
  evaluateEndpoints: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
        endpointIds: z.array(z.string()).optional(), // If not provided, evaluate all
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

      const detectionService = new WindowsVersionDetectionService(ctx.db);

      // Get the active compliance policy for this tenant
      const policy = await ctx.db.windowsCompliancePolicy.findFirst({
        where: {
          tenantId: filter.tenantId,
          isActive: true,
        },
        orderBy: { priority: "asc" },
      });

      if (!policy) {
        throw new Error("No active compliance policy found for this tenant");
      }

      // Get endpoints to evaluate - FIXED field name
      const whereClause: any = {
        ...filter,
        operatingSystem: {
          // FIXED: Use operatingSystem instead of osName
          contains: "Windows",
          mode: "insensitive",
        },
      };

      if (input.endpointIds) {
        whereClause.id = { in: input.endpointIds };
      }

      const endpoints = await ctx.db.endpoint.findMany({
        where: whereClause,
        select: {
          id: true,
          hostname: true,
          operatingSystem: true, // FIXED: Use operatingSystem
          osVersion: true, // FIXED: Use osVersion
        },
      });

      let evaluated = 0;
      let errors = 0;

      for (const endpoint of endpoints) {
        try {
          // Parse Windows version info with correct field names
          const windowsInfo = await detectionService.parseWindowsVersion(
            endpoint.operatingSystem || "", // FIXED: Use operatingSystem
            endpoint.osVersion || "", // FIXED: Use osVersion
          );

          if (!windowsInfo) {
            console.warn(
              `Could not parse Windows version for ${endpoint.hostname}`,
            );
            continue;
          }

          // Evaluate compliance
          const evaluation = await detectionService.evaluateCompliance(
            windowsInfo,
            policy.id,
          );

          // Store evaluation with correct field names
          await detectionService.storeEvaluation(
            endpoint.id,
            policy.id,
            windowsInfo,
            evaluation,
            {
              operatingSystem: endpoint.operatingSystem || "", // FIXED
              osVersion: endpoint.osVersion || "", // FIXED
            },
          );

          // Update endpoint compliance fields
          await ctx.db.endpoint.update({
            where: { id: endpoint.id },
            data: {
              windowsCompliant: evaluation.isCompliant,
              windowsComplianceScore: evaluation.complianceScore,
              lastWindowsCheck: new Date(),
            },
          });

          evaluated++;
        } catch (error) {
          console.error(`Failed to evaluate ${endpoint.hostname}:`, error);
          errors++;
        }
      }

      return {
        evaluated,
        errors,
        total: endpoints.length,
        policy: policy.name,
      };
    }),

  /**
   * Get compliance evaluation history for an endpoint
   */
  getEvaluationHistory: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
        endpointId: z.string(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

      // Verify endpoint belongs to tenant
      const endpoint = await ctx.db.endpoint.findFirst({
        where: {
          id: input.endpointId,
          ...filter,
        },
        select: { id: true, hostname: true },
      });

      if (!endpoint) {
        throw new Error("Endpoint not found or access denied");
      }

      const evaluations = await ctx.db.windowsComplianceEvaluation.findMany({
        where: { endpointId: input.endpointId },
        include: {
          WindowsCompliancePolicy: {
            select: { name: true },
          },
        },
        orderBy: { evaluatedAt: "desc" },
        take: input.limit,
      });

      return {
        endpoint,
        evaluations,
        total: evaluations.length,
      };
    }),

  /**
   * Get detailed Windows endpoint analysis - FIXED for operatingSystem/osVersion structure
   */
  getEndpointAnalysis: adminProcedure
    .input(
      z.object({
        versionFilter: z.enum(["all", "10", "11", "outdated"]).default("all"),
        tenantId: z.string().optional(),
        limit: z.number().min(1).max(1000).default(100),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Get latest supported builds for Windows 10 and 11
      const latestBuilds = await ctx.db.windowsVersion.findMany({
        where: {
          majorVersion: { in: ["10", "11"] },
          isSupported: true,
        },
        orderBy: [{ majorVersion: "desc" }, { releaseDate: "desc" }],
      });

      // Map latest build per major version
      const latestByVersion: Record<string, any> = {};
      for (const version of latestBuilds) {
        if (
          !latestByVersion[version.majorVersion] ||
          new Date(version.releaseDate) >
            new Date(latestByVersion[version.majorVersion].releaseDate)
        ) {
          latestByVersion[version.majorVersion] = version;
        }
      }

      // Build query filter - USING CORRECT FIELD NAMES
      const whereClause: any = {
        operatingSystem: {
          contains: "Windows",
          mode: "insensitive" as const,
        },
      };

      // Apply tenant filter if provided
      if (input.tenantId) {
        const tenant = await ctx.db.tenant.findFirst({
          where: {
            OR: [{ id: input.tenantId }, { slug: input.tenantId }],
          },
          select: { id: true },
        });

        if (tenant) {
          whereClause.tenantId = tenant.id;
        } else {
          return {
            endpoints: [],
            summary: {
              total: 0,
              current: 0,
              outdated: 0,
              unknown: 0,
              windows10: 0,
              windows11: 0,
            },
            totalCount: 0,
            latestBuilds: latestByVersion,
            hasMore: false,
          };
        }
      }

      // Add version filter - USING CORRECT FIELD NAME
      if (input.versionFilter === "10") {
        whereClause.operatingSystem = {
          contains: "Windows 10",
          mode: "insensitive" as const,
        };
      } else if (input.versionFilter === "11") {
        whereClause.operatingSystem = {
          contains: "Windows 11",
          mode: "insensitive" as const,
        };
      }

      // Fetch endpoints with correct field selection
      const endpoints = await ctx.db.endpoint.findMany({
        where: whereClause,
        include: {
          tenant: { select: { name: true, slug: true, id: true } },
        },
        orderBy: [{ tenant: { name: "asc" } }, { hostname: "asc" }],
        take: input.limit,
        skip: input.offset,
      });

      // Analyze compliance with CORRECT FIELD MAPPING
      const analyzedEndpoints = endpoints.map((endpoint) => {
        // Parse major version from operatingSystem (e.g., "Windows 11 Pro" -> "11")
        const versionMatch = endpoint.operatingSystem?.match(/Windows (\d+)/i);
        const majorVersion = versionMatch ? versionMatch[1] : null;

        // Get current build number from osVersion (e.g., "26100" -> 26100)
        const currentBuildNumber = endpoint.osVersion
          ? parseInt(endpoint.osVersion, 10)
          : null;

        // Get latest build info for this major version
        const latestForVersion = majorVersion
          ? latestByVersion[majorVersion]
          : null;

        // Extract latest build number from version registry (e.g., "10.0.26100.2152" -> 26100)
        const latestBuildNumber = latestForVersion
          ? parseInt(latestForVersion.latestBuild.split(".")[2] || "0", 10)
          : null;

        // Determine if up to date
        const isUpToDate =
          latestBuildNumber && currentBuildNumber
            ? currentBuildNumber >= latestBuildNumber
            : false;

        // Calculate rough estimate of how far behind (in builds)
        const buildsBehind =
          latestBuildNumber && currentBuildNumber && !isUpToDate
            ? Math.max(0, latestBuildNumber - currentBuildNumber)
            : 0;

        return {
          id: endpoint.id,
          hostname: endpoint.hostname,
          tenant: endpoint.tenant,
          operatingSystem: endpoint.operatingSystem,
          osVersion: endpoint.osVersion,
          majorVersion,
          currentBuildNumber,
          latestAvailableBuild: latestForVersion?.latestBuild,
          latestBuildNumber,
          isUpToDate,
          buildsBehind,
          complianceStatus: isUpToDate
            ? "current"
            : currentBuildNumber
              ? "outdated"
              : "unknown",
          lastSeen: endpoint.lastSeen,
        };
      });

      // Filter for outdated if requested
      const filteredEndpoints =
        input.versionFilter === "outdated"
          ? analyzedEndpoints.filter((e) => e.complianceStatus === "outdated")
          : analyzedEndpoints;

      // Get total count for pagination
      const totalCount = await ctx.db.endpoint.count({
        where: whereClause,
      });

      // Calculate summary stats
      const summary = {
        total: filteredEndpoints.length,
        current: filteredEndpoints.filter(
          (e) => e.complianceStatus === "current",
        ).length,
        outdated: filteredEndpoints.filter(
          (e) => e.complianceStatus === "outdated",
        ).length,
        unknown: filteredEndpoints.filter(
          (e) => e.complianceStatus === "unknown",
        ).length,
        windows10: filteredEndpoints.filter((e) => e.majorVersion === "10")
          .length,
        windows11: filteredEndpoints.filter((e) => e.majorVersion === "11")
          .length,
      };

      return {
        endpoints: filteredEndpoints,
        summary,
        totalCount,
        latestBuilds: latestByVersion,
        hasMore: input.offset + input.limit < totalCount,
      };
    }),
});

export { windowsComplianceRouter };
