// src/server/api/routers/windows-compliance.ts
// tRPC router for Windows compliance management

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
   * Get compliance summary across all tenants - ADMIN ONLY
   */
  getGlobalComplianceSummary: adminProcedure.query(async ({ ctx }) => {
    const syncService = new EndOfLifeSyncService(ctx.db);
    const versionSummary = await syncService.getComplianceSummary();

    // Get tenant-level compliance stats
    const tenantStats = await ctx.db.tenant.findMany({
      include: {
        _count: {
          select: { endpoints: true },
        },
      },
    });

    // Get global compliance metrics
    const totalEndpoints = await ctx.db.endpoint.count({
      where: {
        osName: {
          contains: "Windows",
          mode: "insensitive",
        },
      },
    });

    const complianceEvaluations =
      await ctx.db.windowsComplianceEvaluation.groupBy({
        by: ["isCompliant"],
        _count: {
          isCompliant: true,
        },
        where: {
          evaluatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      });

    const compliantCount =
      complianceEvaluations.find((e) => e.isCompliant)?._count.isCompliant || 0;
    const nonCompliantCount =
      complianceEvaluations.find((e) => !e.isCompliant)?._count.isCompliant ||
      0;

    return {
      versions: versionSummary,
      tenants: tenantStats.length,
      totalWindowsEndpoints: totalEndpoints,
      complianceOverview: {
        compliant: compliantCount,
        nonCompliant: nonCompliantCount,
        complianceRate:
          totalEndpoints > 0
            ? Math.round((compliantCount / totalEndpoints) * 100)
            : 0,
      },
      tenantBreakdown: tenantStats.map((t) => ({
        name: t.name,
        slug: t.slug,
        endpointCount: t._count.endpoints,
      })),
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

  // ============================================================================
  // TENANT-SCOPED PROCEDURES
  // ============================================================================

  /**
   * Get Windows compliance overview for a tenant
   */
  getComplianceOverview: tenantProcedure
    .input(z.object({ tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

      // Get latest evaluations for each Windows endpoint
      const latestEvaluations = (await ctx.db.$queryRaw`
        SELECT DISTINCT ON (e."id") 
          e."id" as endpoint_id,
          e."hostname",
          e."osName",
          e."osRevision",
          evaluation."evaluatedAt",
          evaluation."isCompliant",
          evaluation."complianceScore",
          evaluation."detectedVersion",
          evaluation."detectedFeatureUpdate",
          evaluation."detectedEdition",
          evaluation."failureReasons",
          evaluation."requiredActions",
          evaluation."buildAgeDays"
        FROM "Endpoint" e
        LEFT JOIN "WindowsComplianceEvaluation" evaluation ON e."id" = evaluation."endpointId"
        WHERE e."tenantId" = ${filter.tenantId}
          AND LOWER(e."osName") LIKE '%windows%'
        ORDER BY e."id", evaluation."evaluatedAt" DESC NULLS LAST
      `) as any[];

      // Calculate summary statistics
      const totalWindows = latestEvaluations.length;
      const evaluated = latestEvaluations.filter((e) => e.evaluatedAt).length;
      const compliant = latestEvaluations.filter((e) => e.isCompliant).length;
      const nonCompliant = evaluated - compliant;
      const needsEvaluation = totalWindows - evaluated;

      // Group by version
      const versionBreakdown = latestEvaluations.reduce(
        (acc, evaluation) => {
          const version = evaluation.detectedVersion || "Unknown";
          const update = evaluation.detectedFeatureUpdate || "Unknown";
          const key = `${version} ${update}`;

          if (!acc[key]) {
            acc[key] = { total: 0, compliant: 0, nonCompliant: 0 };
          }

          acc[key].total++;
          if (evaluation.isCompliant) {
            acc[key].compliant++;
          } else {
            acc[key].nonCompliant++;
          }

          return acc;
        },
        {} as Record<
          string,
          { total: number; compliant: number; nonCompliant: number }
        >,
      );

      // Get common issues
      const commonIssues = await ctx.db.windowsComplianceEvaluation.groupBy({
        by: ["failureReasons"],
        _count: { failureReasons: true },
        where: {
          endpoint: filter,
          isCompliant: false,
          evaluatedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        orderBy: { _count: { failureReasons: "desc" } },
        take: 10,
      });

      return {
        summary: {
          totalWindows,
          evaluated,
          compliant,
          nonCompliant,
          needsEvaluation,
          complianceRate:
            evaluated > 0 ? Math.round((compliant / evaluated) * 100) : 0,
        },
        versionBreakdown,
        commonIssues: commonIssues.map((issue) => ({
          reasons: issue.failureReasons,
          count: issue._count.failureReasons,
        })),
        recentEvaluations: latestEvaluations.slice(0, 20),
      };
    }),

  /**
   * Get detailed Windows endpoints for a tenant
   */
  getWindowsEndpoints: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        complianceFilter: z
          .enum(["all", "compliant", "non-compliant", "not-evaluated"])
          .default("all"),
        versionFilter: z.string().optional(),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

      // Build where clause
      const whereClause: any = {
        ...filter,
        osName: {
          contains: "Windows",
          mode: "insensitive",
        },
      };

      if (input.search) {
        whereClause.hostname = {
          contains: input.search,
          mode: "insensitive",
        };
      }

      // Get endpoints with latest evaluations
      const endpoints = await ctx.db.endpoint.findMany({
        where: whereClause,
        include: {
          client: {
            select: { name: true },
          },
          WindowsComplianceEvaluation: {
            orderBy: { evaluatedAt: "desc" },
            take: 1,
          },
        },
        orderBy: { hostname: "asc" },
        take: input.limit,
        skip: input.offset,
      });

      // Filter by compliance status
      const filteredEndpoints = endpoints.filter((endpoint) => {
        const latestEvaluation = endpoint.WindowsComplianceEvaluation[0];

        switch (input.complianceFilter) {
          case "compliant":
            return latestEvaluation?.isCompliant === true;
          case "non-compliant":
            return latestEvaluation?.isCompliant === false;
          case "not-evaluated":
            return !latestEvaluation;
          default:
            return true;
        }
      });

      // Filter by version
      const versionFilteredEndpoints = input.versionFilter
        ? filteredEndpoints.filter((endpoint) => {
            const latestEvaluation = endpoint.WindowsComplianceEvaluation[0];
            return latestEvaluation?.detectedVersion === input.versionFilter;
          })
        : filteredEndpoints;

      const total = await ctx.db.endpoint.count({ where: whereClause });

      return {
        endpoints: versionFilteredEndpoints.map((endpoint) => ({
          ...endpoint,
          latestEvaluation: endpoint.WindowsComplianceEvaluation[0] || null,
        })),
        total,
        hasMore: total > input.offset + input.limit,
      };
    }),

  /**
   * Get compliance policy for a tenant
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
   * Update compliance policy - tenant admins can modify their own policies
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
          minimumVersions: z.record(z.string()).optional(),
          allowedEditions: z.array(z.string()).optional(),
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
   * Trigger compliance evaluation for specific endpoints
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

      // Get endpoints to evaluate
      const whereClause: any = {
        ...filter,
        osName: {
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
          osName: true,
          osRevision: true,
        },
      });

      let evaluated = 0;
      let errors = 0;

      for (const endpoint of endpoints) {
        try {
          // Parse Windows version info
          const windowsInfo = await detectionService.parseWindowsVersion(
            endpoint.osName || "",
            endpoint.osRevision || "",
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

          // Store evaluation
          await detectionService.storeEvaluation(
            endpoint.id,
            policy.id,
            windowsInfo,
            evaluation,
            {
              osName: endpoint.osName || "",
              osRevision: endpoint.osRevision || "",
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
});

export { windowsComplianceRouter };
