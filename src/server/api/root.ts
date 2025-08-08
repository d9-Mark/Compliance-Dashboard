import { postRouter } from "~/server/api/routers/post";
import { tenantRouter } from "~/server/api/routers/tenant";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { sentinelOneRouter } from "~/server/api/routers/sentinelone-enhanced";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  tenant: tenantRouter,
  sentinelOne: sentinelOneRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 */
export const createCaller = createCallerFactory(appRouter);
