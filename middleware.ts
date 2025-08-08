import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "~/server/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and API routes (except auth)
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.includes(".") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Get session
  const session = await auth();

  // Public routes that don't require authentication
  const publicRoutes = ["/", "/auth/signin", "/auth/error", "/auth/signout"];
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to sign in
  if (!session?.user) {
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(signInUrl);
  }

  // Handle tenant-based routing
  if (pathname.startsWith("/tenant/")) {
    return handleTenantRouting(request, session);
  }

  // Handle admin routes
  if (pathname.startsWith("/admin")) {
    return handleAdminRouting(request, session);
  }

  // Let dashboard and auth/success pages handle their own redirects
  if (pathname === "/dashboard" || pathname === "/auth/success") {
    return NextResponse.next();
  }

  return NextResponse.next();
}

/**
 * Handle routing for tenant-specific pages
 */
async function handleTenantRouting(request: NextRequest, session: any) {
  const { pathname } = request.nextUrl;
  const pathParts = pathname.split("/");
  const tenantSlug = pathParts[2];

  // Ensure tenant slug is provided
  if (!tenantSlug) {
    return NextResponse.redirect(new URL("/auth/success", request.url));
  }

  // D9 admins can access any tenant
  if (session.user.role === "ADMIN") {
    return NextResponse.next();
  }

  // Regular users can only access their own tenant
  if (session.user.tenantSlug !== tenantSlug) {
    // Redirect to their own tenant or show forbidden
    if (session.user.tenantSlug) {
      return NextResponse.redirect(
        new URL(`/tenant/${session.user.tenantSlug}/dashboard`, request.url),
      );
    } else {
      return NextResponse.redirect(
        new URL("/auth/error?error=NoTenant", request.url),
      );
    }
  }

  return NextResponse.next();
}

/**
 * Handle routing for admin-only pages
 */
async function handleAdminRouting(request: NextRequest, session: any) {
  // Only D9 admins can access admin routes
  if (session.user.role !== "ADMIN") {
    // Redirect regular users to their tenant dashboard
    if (session.user.tenantSlug) {
      return NextResponse.redirect(
        new URL(`/tenant/${session.user.tenantSlug}/dashboard`, request.url),
      );
    } else {
      return NextResponse.redirect(
        new URL("/auth/error?error=AccessDenied", request.url),
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
