// src/app/admin/dashboard/page.tsx (Server-side version)
import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { AdminDashboardClient } from "./client";

export default async function AdminDashboard() {
  const session = await auth();

  // Check if user is authenticated
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/admin/dashboard");
  }

  // Check if user is admin
  if (session.user.role !== "ADMIN") {
    if (session.user.tenantSlug) {
      redirect(`/tenant/${session.user.tenantSlug}/dashboard`);
    } else {
      redirect("/auth/error?error=AccessDenied");
    }
  }

  // Pass session to client component
  return <AdminDashboardClient session={session} />;
}
