// FIXED PAGE.TSX - src/app/tenant/[slug]/dashboard/page.tsx
import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { EnhancedTenantDashboard } from "./client";

interface TenantDashboardPageProps {
  params: Promise<{ slug: string }>; // Next.js 15 requirement
}

export default async function TenantDashboard({
  params,
}: TenantDashboardPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  // Await params in Next.js 15
  const { slug } = await params;

  // Check if user has access to this tenant
  if (session.user.role !== "ADMIN" && session.user.tenantSlug !== slug) {
    // Redirect to their own tenant or show access denied
    if (session.user.tenantSlug) {
      redirect(`/tenant/${session.user.tenantSlug}/dashboard`);
    } else {
      redirect("/auth/error?error=AccessDenied");
    }
  }

  // Pass session and slug to client component
  return <EnhancedTenantDashboard session={session} tenantSlug={slug} />;
}
