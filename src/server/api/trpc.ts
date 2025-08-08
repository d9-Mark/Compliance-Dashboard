/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { type UserRole } from "@prisma/client";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();

  return {
    db,
    session,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Middleware to ensure user is authenticated and add user info to context
 */
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  // Fetch full user data including tenant and role
  const user = await ctx.db.user.findUnique({
    where: { id: ctx.session.user.id },
    include: {
      tenant: true,
    },
  });

  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not found in database",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: { ...ctx.session, user: ctx.session.user },
      user,
    },
  });
});

/**
 * Middleware to ensure user has admin privileges (D9 admin)
 */
const adminMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const user = await ctx.db.user.findUnique({
    where: { id: ctx.session.user.id },
    include: { tenant: true },
  });

  if (!user || user.role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: { ...ctx.session, user: ctx.session.user },
      user,
    },
  });
});

/**
 * Middleware to filter data by tenant (for tenant users)
 */
const tenantMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const user = await ctx.db.user.findUnique({
    where: { id: ctx.session.user.id },
    include: { tenant: true },
  });

  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not found in database",
    });
  }

  // D9 admins can access any tenant data (but should specify tenantId in input)
  if (user.role === "ADMIN") {
    return next({
      ctx: {
        ...ctx,
        session: { ...ctx.session, user: ctx.session.user },
        user,
        isAdmin: true,
        tenantId: null, // Admin can access any tenant
      },
    });
  }

  // Regular users can only access their own tenant data
  if (!user.tenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User not assigned to a tenant",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: { ...ctx.session, user: ctx.session.user },
      user,
      isAdmin: false,
      tenantId: user.tenantId,
    },
  });
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware);

/**
 * Admin-only procedure
 *
 * Only accessible to D9 admin users. Use this for admin-only operations like
 * creating new tenants, viewing all tenant data, etc.
 */
export const adminProcedure = t.procedure
  .use(timingMiddleware)
  .use(adminMiddleware);

/**
 * Tenant-scoped procedure
 *
 * Automatically filters data by the user's tenant. For admin users, they need to
 * specify tenantId in their input. For regular users, data is automatically
 * filtered to their tenant.
 */
export const tenantProcedure = t.procedure
  .use(timingMiddleware)
  .use(tenantMiddleware);

/**
 * Helper function to get tenant filter for Prisma queries
 * Use this in your routers to ensure proper tenant isolation
 */
export const getTenantFilter = (ctx: {
  isAdmin: boolean;
  tenantId: string | null;
  inputTenantId?: string;
}) => {
  // Admin users must specify tenantId in input for tenant-specific queries
  if (ctx.isAdmin) {
    if (!ctx.inputTenantId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Admin users must specify tenantId",
      });
    }
    return { tenantId: ctx.inputTenantId };
  }

  // Regular users are automatically scoped to their tenant
  if (!ctx.tenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User not assigned to a tenant",
    });
  }

  return { tenantId: ctx.tenantId };
};

/**
 * Helper function for admin queries that can optionally filter by tenant
 */
export const getAdminTenantFilter = (inputTenantId?: string) => {
  return inputTenantId ? { tenantId: inputTenantId } : {};
};
