// src/app/page.tsx - Cleaned up version
import Link from "next/link";
import { auth } from "~/server/auth";

export default async function Home() {
  const session = await auth();

  // Determine the correct dashboard URL for the user
  const getDashboardUrl = () => {
    if (!session?.user) return "/auth/signin";

    if (session.user.role === "ADMIN") {
      return "/admin/dashboard";
    }

    if (session.user.tenantSlug) {
      return `/tenant/${session.user.tenantSlug}/dashboard`;
    }

    return "/auth/error?error=NoTenant";
  };

  const dashboardUrl = getDashboardUrl();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            D9 <span className="text-[hsl(280,100%,70%)]">Compliance</span>
          </h1>
          <p className="mt-4 text-xl text-white/80">
            Unified security compliance dashboard
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
          <div className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20">
            <h3 className="text-2xl font-bold">🛡️ SentinelOne Integration</h3>
            <div className="text-lg">
              Real-time endpoint security monitoring and compliance tracking
            </div>
          </div>

          <div className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20">
            <h3 className="text-2xl font-bold">🪟 Windows Compliance</h3>
            <div className="text-lg">
              Automated Windows version tracking and update management
            </div>
          </div>

          <div className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20">
            <h3 className="text-2xl font-bold">🏢 Multi-Tenant</h3>
            <div className="text-lg">
              Manage multiple client environments with tenant isolation
            </div>
          </div>

          <div className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20">
            <h3 className="text-2xl font-bold">📊 Real-time Dashboards</h3>
            <div className="text-lg">
              Live compliance scores, threat detection, and remediation tracking
            </div>
          </div>
        </div>

        {/* User Status & Actions */}
        <div className="flex flex-col items-center gap-6">
          {session?.user ? (
            <div className="text-center">
              <p className="mb-4 text-xl text-white/90">
                Welcome back,{" "}
                <span className="font-semibold">{session.user.name}</span>
                {session.user.role === "ADMIN" && (
                  <span className="ml-2 rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-800">
                    ADMIN
                  </span>
                )}
              </p>

              <div className="flex gap-4">
                <Link
                  href={dashboardUrl}
                  className="rounded-full bg-[hsl(280,100%,70%)] px-8 py-3 font-semibold text-white transition hover:bg-[hsl(280,100%,60%)]"
                >
                  {session.user.role === "ADMIN"
                    ? "Go to Admin Dashboard →"
                    : "Go to Dashboard →"}
                </Link>

                <Link
                  href="/auth/signout"
                  className="rounded-full bg-white/10 px-8 py-3 font-semibold transition hover:bg-white/20"
                >
                  Sign Out
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="mb-4 text-xl text-white/90">
                Secure access to your compliance data
              </p>

              <Link
                href="/auth/signin"
                className="rounded-full bg-[hsl(280,100%,70%)] px-8 py-3 font-semibold text-white transition hover:bg-[hsl(280,100%,60%)]"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-white/60">
          <p className="text-sm">
            Powered by SentinelOne • Built with Next.js & tRPC
          </p>
        </div>
      </div>
    </main>
  );
}
