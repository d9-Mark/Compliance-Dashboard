// src/app/auth/signin/page.tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "~/server/auth";
import { SignInForm } from "./form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  const session = await auth();

  // If already signed in, redirect based on user role
  if (session?.user) {
    const redirectUrl = getRedirectUrl(session.user, searchParams.callbackUrl);
    redirect(redirectUrl);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c]">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            D9 <span className="text-[hsl(280,100%,70%)]">Compliance</span>{" "}
            Dashboard
          </h1>
          <p className="text-xl text-white/80">
            Secure access to your compliance data
          </p>
        </div>

        <div className="w-full max-w-md">
          <div className="rounded-lg bg-white/10 p-8 shadow-xl backdrop-blur-sm">
            <h2 className="mb-6 text-center text-2xl font-bold text-white">
              Sign In
            </h2>

            {searchParams.error && (
              <div className="mb-4 rounded-md border border-red-500/50 bg-red-500/20 p-4">
                <p className="text-sm text-red-200">
                  {getErrorMessage(searchParams.error)}
                </p>
              </div>
            )}

            <SignInForm callbackUrl={searchParams.callbackUrl} />

            <div className="mt-6 text-center">
              <p className="text-sm text-white/60">
                Need access? Contact your D9 administrator.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="text-white/60 transition-colors hover:text-white"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function getRedirectUrl(user: any, callbackUrl?: string): string {
  // If there's a specific callback URL, use it (with validation)
  if (callbackUrl) {
    try {
      const url = new URL(callbackUrl);
      // Only allow redirects to the same origin for security
      if (
        url.origin ===
        new URL("/", process.env.NEXTAUTH_URL || "http://localhost:3000").origin
      ) {
        return callbackUrl;
      }
    } catch {
      // Invalid URL, fall through to default logic
    }
  }

  // Default redirect logic based on user role
  if (user.role === "ADMIN") {
    return "/admin/dashboard";
  }

  if (user.tenantSlug) {
    return `/tenant/${user.tenantSlug}/dashboard`;
  }

  // Fallback for users without proper setup
  return "/auth/error?error=NoTenant";
}

function getErrorMessage(error: string): string {
  switch (error) {
    case "CredentialsSignin":
      return "Invalid email or password. Please check your credentials.";
    case "SessionRequired":
      return "Please sign in to access this page.";
    case "NoTenant":
      return "Your account is not associated with any tenant. Please contact your administrator.";
    case "AccessDenied":
      return "You don't have permission to access this resource.";
    default:
      return "An error occurred during sign in.";
  }
}
