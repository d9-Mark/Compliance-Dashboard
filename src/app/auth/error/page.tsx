// src/app/auth/error/page.tsx
import Link from "next/link";

interface AuthErrorPageProps {
  searchParams: { error?: string };
}

export default function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const error = searchParams.error;

  const getErrorMessage = (errorCode?: string) => {
    switch (errorCode) {
      case "NoTenant":
        return {
          title: "No Tenant Access",
          message:
            "Your account is not associated with any tenant. Please contact your D9 administrator to get access.",
          action: "Contact Administrator",
        };
      case "AccessDenied":
        return {
          title: "Access Denied",
          message: "You don't have permission to access this resource.",
          action: "Go Back",
        };
      default:
        return {
          title: "Authentication Error",
          message:
            "An error occurred during authentication. Please try signing in again.",
          action: "Try Again",
        };
    }
  };

  const errorInfo = getErrorMessage(error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] p-4">
      <div className="w-full max-w-md rounded-lg bg-white/10 p-8 text-center shadow-xl backdrop-blur-sm">
        <div className="mb-6">
          <div className="mb-4 text-6xl">⚠️</div>
          <h1 className="mb-2 text-2xl font-bold text-white">
            {errorInfo.title}
          </h1>
          <p className="text-white/80">{errorInfo.message}</p>
        </div>

        <div className="space-y-4">
          <Link
            href="/auth/signin"
            className="block w-full rounded-lg bg-[hsl(280,100%,70%)] px-4 py-3 font-semibold text-white transition-colors hover:bg-[hsl(280,100%,60%)]"
          >
            Sign In Again
          </Link>

          {error === "NoTenant" && (
            <div className="text-sm text-white/60">
              <p>If you believe this is an error, please contact:</p>
              <p className="font-mono">support@d9.com</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
