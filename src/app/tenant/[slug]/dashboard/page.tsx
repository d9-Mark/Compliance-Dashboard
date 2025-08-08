import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { TenantDashboardClient } from "./client";

interface TenantDashboardProps {
  params: { slug: string };
}

export default async function TenantDashboard({
  params,
}: TenantDashboardProps) {
  const session = await auth();

  // Check if user is authenticated
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/tenant/" + params.slug + "/dashboard");
  }

  // Check if user has access to this tenant
  if (
    session.user.role !== "ADMIN" &&
    session.user.tenantSlug !== params.slug
  ) {
    // Redirect to their own tenant or show access denied
    if (session.user.tenantSlug) {
      redirect(`/tenant/${session.user.tenantSlug}/dashboard`);
    } else {
      redirect("/auth/error?error=AccessDenied");
    }
  }

  // Pass session and slug to client component
  return <TenantDashboardClient session={session} tenantSlug={params.slug} />;
}
