import { redirect } from "next/navigation";
import { auth, signOut } from "~/server/auth";
import { SignOutClient } from "./client";

export default async function SignOutPage() {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  const dashboardUrl =
    session.user.role === "ADMIN"
      ? "/admin/dashboard"
      : session.user.tenantSlug
        ? `/tenant/${session.user.tenantSlug}/dashboard`
        : "/dashboard";

  const handleSignOut = async () => {
    "use server";
    await signOut({ redirectTo: "/auth/signin" });
  };

  return (
    <SignOutClient
      user={{
        name: session.user.name,
        email: session.user.email,
      }}
      dashboardUrl={dashboardUrl}
      signOutAction={handleSignOut}
    />
  );
}
