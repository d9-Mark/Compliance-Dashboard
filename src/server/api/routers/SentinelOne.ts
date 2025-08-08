import { z } from "zod";
import { env } from "~/env";
import {
  adminProcedure,
  createTRPCRouter,
  getTenantFilter,
  protectedProcedure,
  tenantProcedure,
} from "~/server/api/trpc";
import { SentinelOneService } from "~/server/services/sentinelone";

// tRPC router for SentinelOne integration
export const sentinelOneRouter = createTRPCRouter({
  // Manual sync trigger
  syncAgents: adminProcedure
    .input(z.object({ tenantId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SentinelOneService(
        env.SENTINELONE_API_KEY!,
        env.SENTINELONE_ENDPOINT!,
        ctx.db,
      );

      return service.syncAgents(input.tenantId);
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

      return ctx.db.syncJob.findMany({
        where: {
          ...filter,
          source: "SENTINELONE",
        },
        orderBy: { startedAt: "desc" },
        take: 10,
      });
    }),
});
