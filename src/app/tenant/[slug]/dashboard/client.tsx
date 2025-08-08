//src/app/tenant/[slug]/dashboard/client.tsx;
"use client";

import { api } from "~/trpc/react";
import type { Session } from "next-auth";
import Link from "next/link";

interface TenantDashboardClientProps {
  session: Session;
  tenantSlug: string;
}

export function TenantDashboardClient({
  session,
  tenantSlug,
}: TenantDashboardClientProps) {
  // For tenant users, we don't need to specify tenantId - it's automatic
  // For admin users testing a specific tenant, we need to pass the tenantId
  const { data: overview, isLoading } = api.tenant.getOverview.useQuery(
    session.user.role === "ADMIN"
      ? { tenantId: session.user.tenantId || undefined }
      : {},
  );

  const { data: endpoints } = api.tenant.getEndpoints.useQuery(
    session.user.role === "ADMIN"
      ? { tenantId: session.user.tenantId || undefined, limit: 10 }
      : { limit: 10 },
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-red-600">Error</h1>
          <p className="text-gray-600">Unable to load tenant data</p>
          <Link
            href="/auth/signin"
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            Sign in again
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {overview.tenant.name}
              </h1>
              <p className="text-gray-600">
                Welcome back, {session.user.name}
                {session.user.role === "ADMIN" && (
                  <span className="ml-2 rounded-full bg-purple-100 px-2 py-1 text-xs text-purple-800">
                    ADMIN VIEW
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {session.user.role === "ADMIN" && (
                <Link
                  href="/admin/dashboard"
                  className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
                >
                  ← Admin Dashboard
                </Link>
              )}
              <Link
                href="/auth/signout"
                className="rounded-lg bg-red-100 px-4 py-2 text-red-700 transition-colors hover:bg-red-200"
              >
                Sign Out
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Stats Overview - PROBLEM FOCUSED */}
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Critical Issues"
            value={overview.stats.vulnerabilities.critical}
            icon="🚨"
            color="red"
            urgent={overview.stats.vulnerabilities.critical > 0}
          />
          <StatsCard
            title="High Priority"
            value={overview.stats.vulnerabilities.high}
            icon="⚠️"
            color="orange"
            urgent={overview.stats.vulnerabilities.high > 0}
          />
          <StatsCard
            title="Non-Compliant"
            value={overview.stats.endpoints.nonCompliant}
            icon="❌"
            color="red"
            urgent={overview.stats.endpoints.nonCompliant > 0}
          />
          <StatsCard
            title="Compliance Rate"
            value={
              overview.stats.endpoints.total > 0
                ? `${Math.round((overview.stats.endpoints.compliant / overview.stats.endpoints.total) * 100)}%`
                : "0%"
            }
            icon="📊"
            color={
              overview.stats.endpoints.total > 0 &&
              overview.stats.endpoints.compliant /
                overview.stats.endpoints.total >=
                0.9
                ? "green"
                : "orange"
            }
          />
        </div>

        {/* Problem Summary */}
        <div className="mb-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              🚨 Critical Problems
            </h3>
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-red-600">
                {overview.stats.vulnerabilities.critical}
              </div>
              <p className="text-sm text-gray-600">
                {overview.stats.vulnerabilities.critical === 0
                  ? "No critical issues! 🎉"
                  : "Require immediate attention"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              ⚠️ All Vulnerabilities
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-red-600">Critical</span>
                <span className="font-semibold">
                  {overview.stats.vulnerabilities.critical}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-orange-600">High</span>
                <span className="font-semibold">
                  {overview.stats.vulnerabilities.high}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-yellow-600">Medium</span>
                <span className="font-semibold">
                  {overview.stats.vulnerabilities.medium}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-600">Low</span>
                <span className="font-semibold">
                  {overview.stats.vulnerabilities.low}
                </span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>
                    {overview.stats.vulnerabilities.critical +
                      overview.stats.vulnerabilities.high +
                      overview.stats.vulnerabilities.medium +
                      overview.stats.vulnerabilities.low}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              📈 Compliance Status
            </h3>
            <div className="mb-4 text-center">
              <div className="mb-2 text-3xl font-bold">
                <span
                  className={
                    overview.stats.endpoints.total > 0 &&
                    overview.stats.endpoints.compliant /
                      overview.stats.endpoints.total >=
                      0.9
                      ? "text-green-600"
                      : "text-orange-600"
                  }
                >
                  {overview.stats.endpoints.total > 0
                    ? `${Math.round((overview.stats.endpoints.compliant / overview.stats.endpoints.total) * 100)}%`
                    : "0%"}
                </span>
              </div>
              <div className="mb-3 h-3 w-full rounded-full bg-gray-200">
                <div
                  className="h-3 rounded-full bg-green-500 transition-all duration-300"
                  style={{
                    width:
                      overview.stats.endpoints.total > 0
                        ? `${(overview.stats.endpoints.compliant / overview.stats.endpoints.total) * 100}%`
                        : "0%",
                  }}
                ></div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-green-600">✅ Compliant</span>
                <span className="font-semibold">
                  {overview.stats.endpoints.compliant}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-600">❌ Issues</span>
                <span className="font-semibold">
                  {overview.stats.endpoints.nonCompliant}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>📊 Total Endpoints</span>
                <span>{overview.stats.endpoints.total}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Problem Endpoints - Show only endpoints with issues */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Endpoints with Issues</h3>
              <span className="text-sm text-gray-500">
                {endpoints?.endpoints.filter(
                  (e) =>
                    !e.isCompliant || e.criticalVulns > 0 || e.highVulns > 0,
                ).length || 0}{" "}
                of {endpoints?.endpoints.length || 0} have problems
              </span>
            </div>
          </div>
          <div className="p-6">
            {endpoints?.endpoints.length ? (
              <div className="space-y-4">
                {/* Show problem endpoints first */}
                {endpoints.endpoints
                  .filter(
                    (endpoint) =>
                      !endpoint.isCompliant ||
                      endpoint.criticalVulns > 0 ||
                      endpoint.highVulns > 0,
                  )
                  .map((endpoint) => (
                    <EndpointCard
                      key={endpoint.id}
                      endpoint={endpoint}
                      showProblems={true}
                    />
                  ))}

                {/* Show a few compliant endpoints */}
                {endpoints.endpoints
                  .filter(
                    (endpoint) =>
                      endpoint.isCompliant &&
                      endpoint.criticalVulns === 0 &&
                      endpoint.highVulns === 0,
                  )
                  .slice(0, 3)
                  .map((endpoint) => (
                    <EndpointCard
                      key={endpoint.id}
                      endpoint={endpoint}
                      showProblems={false}
                    />
                  ))}

                {endpoints.endpoints.filter(
                  (e) =>
                    e.isCompliant && e.criticalVulns === 0 && e.highVulns === 0,
                ).length > 3 && (
                  <div className="border-t py-4 text-center text-gray-500">
                    +{" "}
                    {endpoints.endpoints.filter(
                      (e) =>
                        e.isCompliant &&
                        e.criticalVulns === 0 &&
                        e.highVulns === 0,
                    ).length - 3}{" "}
                    more compliant endpoints
                  </div>
                )}
              </div>
            ) : (
              <p className="py-8 text-center text-gray-600">
                No endpoints found.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EndpointCard({
  endpoint,
  showProblems,
}: {
  endpoint: any;
  showProblems: boolean;
}) {
  const hasProblems =
    !endpoint.isCompliant ||
    endpoint.criticalVulns > 0 ||
    endpoint.highVulns > 0;

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        hasProblems
          ? "border-red-200 bg-red-50 hover:bg-red-100"
          : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{endpoint.hostname}</h4>
            {hasProblems && <span className="text-red-500">⚠️</span>}
          </div>
          <p className="text-sm text-gray-600">
            {endpoint.client?.name || "Unassigned"} • {endpoint.operatingSystem}
          </p>
          <p className="text-xs text-gray-500">
            Last seen:{" "}
            {endpoint.lastSeen
              ? new Date(endpoint.lastSeen).toLocaleDateString()
              : "Never"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              endpoint.isCompliant
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {endpoint.isCompliant ? "✅ Compliant" : "❌ Issues"}
          </span>
          <div className="flex gap-2">
            {endpoint.criticalVulns > 0 && (
              <span className="rounded bg-red-600 px-2 py-1 text-xs font-bold text-white">
                🚨 {endpoint.criticalVulns} Critical
              </span>
            )}
            {endpoint.highVulns > 0 && (
              <span className="rounded bg-orange-500 px-2 py-1 text-xs font-bold text-white">
                ⚠️ {endpoint.highVulns} High
              </span>
            )}
            {endpoint.mediumVulns > 0 && showProblems && (
              <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                {endpoint.mediumVulns} Med
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsCard({
  title,
  value,
  icon,
  color,
  urgent = false,
}: {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  urgent?: boolean;
}) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    red: "bg-red-50 border-red-200",
    orange: "bg-orange-50 border-orange-200",
  };

  const urgentClass = urgent
    ? "ring-2 ring-red-400 ring-opacity-50 animate-pulse"
    : "";

  return (
    <div
      className={`rounded-lg border p-6 ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue} ${urgentClass}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <h3 className="font-medium text-gray-900">{title}</h3>
          <div
            className={`mt-1 text-2xl font-bold ${urgent ? "text-red-700" : ""}`}
          >
            {value}
            {urgent && value !== 0 && <span className="ml-1 text-sm">!</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
