import z from "zod";
import {
  createTRPCRouter,
  getTenantFilter,
  protectedProcedure,
  publicProcedure,
  tenantProcedure,
} from "~/server/api/trpc";

// ============================================================================
// UPDATED POST ROUTER (src/server/api/routers/post.ts)
// ============================================================================

export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  create: tenantProcedure
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

      return ctx.db.post.create({
        data: {
          name: input.name,
          createdBy: { connect: { id: ctx.user.id } },
          // Note: You'd need to add tenantId to Post model if you want tenant isolation
        },
      });
    }),

  getLatest: tenantProcedure
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

      const post = await ctx.db.post.findFirst({
        orderBy: { createdAt: "desc" },
        where: {
          createdBy: { id: ctx.user.id },
          // Add tenant filter if Post model has tenantId
        },
      });

      return post ?? null;
    }),

  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});
