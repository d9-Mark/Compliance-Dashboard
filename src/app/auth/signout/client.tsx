// src/app/auth/signout/client.tsx (Client Component)
"use client";

import Link from "next/link";

interface SignOutClientProps {
  user: {
    name?: string | null;
    email?: string | null;
  };
  dashboardUrl: string;
  signOutAction: () => Promise<void>;
}

export function SignOutClient({
  user,
  dashboardUrl,
  signOutAction,
}: SignOutClientProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] p-4">
      <div className="w-full max-w-md rounded-lg bg-white/10 p-8 shadow-xl backdrop-blur-sm">
        <div className="mb-6 text-center">
          <h1 className="mb-4 text-3xl font-bold text-white">
            D9 <span className="text-[hsl(280,100%,70%)]">Compliance</span>
          </h1>
          <h2 className="mb-2 text-xl font-semibold text-white">Sign Out</h2>
          <p className="text-white/80">Are you sure you want to sign out?</p>
          <p className="mt-2 text-sm text-white/60">
            {user.name || user.email}
          </p>
        </div>

        <div className="space-y-4">
          {/* Sign Out Form */}
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full rounded-lg bg-red-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-transparent focus:outline-none"
            >
              Yes, Sign Out
            </button>
          </form>

          {/* Cancel Link */}
          <Link
            href={dashboardUrl}
            className="block w-full rounded-lg border border-white/30 bg-white/20 px-4 py-3 text-center font-semibold text-white transition-colors hover:bg-white/30 focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent focus:outline-none"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
