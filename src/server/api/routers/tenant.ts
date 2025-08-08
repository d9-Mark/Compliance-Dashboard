// ============================================================================
// TENANT ROUTER
// ============================================================================

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
   * Get tenant overview with stats - admin can specify tenant, users get their own
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
        where: { id: tenantId }, // Use 'id' for tenant table
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
        where: { tenantId }, // Use tenantId for endpoint table
        _count: {
          id: true,
        },
      });

      // Get vulnerability stats
      const vulnStats = await ctx.db.endpoint.aggregate({
        where: { tenantId }, // Use tenantId for endpoint table
        _sum: {
          criticalVulns: true,
          highVulns: true,
          mediumVulns: true,
          lowVulns: true,
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
          },
          vulnerabilities: {
            critical: vulnStats._sum.criticalVulns ?? 0,
            high: vulnStats._sum.highVulns ?? 0,
            medium: vulnStats._sum.mediumVulns ?? 0,
            low: vulnStats._sum.lowVulns ?? 0,
          },
        },
      };
    }),

  // ============================================================================
  // ENDPOINT MANAGEMENT
  // ============================================================================

  /**
   * Get endpoints for a tenant
   */
  getEndpoints: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().optional(), // Only required for admin users
        clientId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
        complianceFilter: z
          .enum(["all", "compliant", "non-compliant"])
          .default("all"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

      // Build where clause
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
      };

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
          orderBy: { lastSeen: "desc" },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.db.endpoint.count({ where }),
      ]);

      return {
        endpoints,
        total,
        hasMore: total > input.offset + input.limit,
      };
    }),

  /**
   * Get single endpoint details
   */
  getEndpoint: tenantProcedure
    .input(
      z.object({
        endpointId: z.string(),
        tenantId: z.string().optional(), // Only required for admin users
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
  // CLIENT MANAGEMENT
  // ============================================================================

  /**
   * Get clients for a tenant
   */
  getClients: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().optional(), // Only required for admin users
      }),
    )
    .query(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

      return ctx.db.client.findMany({
        where: filter, // This is correct - clients table has tenantId field
        include: {
          _count: {
            select: { endpoints: true },
          },
        },
        orderBy: { name: "asc" },
      });
    }),

  /**
   * Create a new client within a tenant
   */
  createClient: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1),
        tenantId: z.string().optional(), // Only required for admin users
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
  // SYNC STATUS
  // ============================================================================

  /**
   * Get latest sync status for a tenant
   */
  getSyncStatus: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().optional(), // Only required for admin users
      }),
    )
    .query(async ({ ctx, input }) => {
      const filter = getTenantFilter({
        isAdmin: ctx.isAdmin,
        tenantId: ctx.tenantId,
        inputTenantId: input.tenantId,
      });

      // Get latest sync jobs for each source
      const syncJobs = await ctx.db.syncJob.findMany({
        where: filter, // This is correct - syncJob table has tenantId field
        orderBy: { startedAt: "desc" },
        take: 10, // Get recent jobs for each source
      });

      // Group by source and get the latest for each
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
