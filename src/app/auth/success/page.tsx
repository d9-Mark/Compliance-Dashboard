// src/app/auth/success/page.tsx
import { redirect } from "next/navigation";
import { auth } from "~/server/auth";

export default async function AuthSuccessPage() {
  const session = await auth();

  // If not authenticated, redirect to sign in
  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Redirect based on user role
  if (session.user.role === "ADMIN") {
    redirect("/admin/dashboard");
  }

  if (session.user.tenantSlug) {
    redirect(`/tenant/${session.user.tenantSlug}/dashboard`);
  }

  // Fallback for users without proper setup
  redirect("/auth/error?error=NoTenant");
}
