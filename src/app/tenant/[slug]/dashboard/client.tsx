//src/app/tenant/[slug]/dashboard/client.tsx
"use client";

import { api } from "~/trpc/react";
import type { Session } from "next-auth";
import Link from "next/link";
import { useState } from "react";

interface TenantDashboardClientProps {
  session: Session;
  tenantSlug: string;
}

export function TenantDashboardClient({
  session,
  tenantSlug,
}: TenantDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "windows" | "endpoints"
  >("overview");

  // For admin users, we need to get the tenant ID from the slug
  const { data: tenantData } = api.tenant.getAll.useQuery(undefined, {
    enabled: session.user.role === "ADMIN",
    select: (tenants) => tenants.find((t) => t.slug === tenantSlug),
  });

  // Determine the tenant ID to use for queries
  const queryTenantId =
    session.user.role === "ADMIN" ? tenantData?.id : undefined; // For regular users, tenantId is automatically determined by middleware

  // For tenant users, we don't need to specify tenantId - it's automatic
  // For admin users, we need to pass the resolved tenantId
  const { data: overview, isLoading } = api.tenant.getOverview.useQuery(
    session.user.role === "ADMIN" ? { tenantId: queryTenantId } : {},
    { enabled: session.user.role !== "ADMIN" || !!queryTenantId },
  );

  const { data: endpoints } = api.tenant.getEndpoints.useQuery(
    session.user.role === "ADMIN"
      ? { tenantId: queryTenantId, limit: 10 }
      : { limit: 10 },
    { enabled: session.user.role !== "ADMIN" || !!queryTenantId },
  );

  const { data: windowsSummary } = api.tenant.getWindowsVersionSummary.useQuery(
    session.user.role === "ADMIN" ? { tenantId: queryTenantId } : {},
    { enabled: session.user.role !== "ADMIN" || !!queryTenantId },
  );

  if (
    isLoading ||
    (session.user.role === "ADMIN" && !tenantData && !queryTenantId)
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">
            {session.user.role === "ADMIN"
              ? "Loading tenant data..."
              : "Loading dashboard..."}
          </p>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-red-600">
            {session.user.role === "ADMIN" && !tenantData
              ? "Tenant Not Found"
              : "Error"}
          </h1>
          <p className="text-gray-600">
            {session.user.role === "ADMIN" && !tenantData
              ? `No tenant found with slug '${tenantSlug}' or you don't have access to it.`
              : "Unable to load tenant data"}
          </p>
          <Link
            href={
              session.user.role === "ADMIN"
                ? "/admin/dashboard"
                : "/auth/signin"
            }
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            {session.user.role === "ADMIN"
              ? "← Back to Admin Dashboard"
              : "Sign in again"}
          </Link>
        </div>
      </div>
    );
  }

  const hasWindowsIssues =
    overview.stats.windows.outdated > 0 || overview.stats.windows.unknown > 0;
  const windowsComplianceRate =
    overview.stats.windows.total > 0
      ? Math.round(
          (overview.stats.windows.compliant / overview.stats.windows.total) *
            100,
        )
      : 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {session.user.role === "ADMIN" && tenantData
                  ? tenantData.name
                  : overview.tenant.name}
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

      {/* Navigation Tabs */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab("overview")}
              className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === "overview"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("windows")}
              className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === "windows"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Windows Versions
              {hasWindowsIssues && (
                <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-red-500"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("endpoints")}
              className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === "endpoints"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              All Endpoints
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {activeTab === "overview" && (
          <OverviewTab overview={overview} endpoints={endpoints} />
        )}
        {activeTab === "windows" && (
          <WindowsTab overview={overview} windowsSummary={windowsSummary} />
        )}
        {activeTab === "endpoints" && <EndpointsTab endpoints={endpoints} />}
      </div>
    </div>
  );
}

function OverviewTab({
  overview,
  endpoints,
}: {
  overview: any;
  endpoints: any;
}) {
  const hasWindowsIssues =
    overview.stats.windows.outdated > 0 || overview.stats.windows.unknown > 0;

  return (
    <div className="space-y-8">
      {/* Critical Issues Alert */}
      {(overview.stats.vulnerabilities.critical > 0 ||
        overview.stats.endpoints.nonCompliant > 0 ||
        hasWindowsIssues) && (
        <div className="rounded border-l-4 border-red-400 bg-red-50 p-4">
          <div className="flex items-center">
            <span className="mr-2 text-xl text-red-500">🚨</span>
            <div>
              <h3 className="font-medium text-red-800">
                Critical Issues Detected
              </h3>
              <div className="text-sm text-red-700">
                {overview.stats.vulnerabilities.critical > 0 && (
                  <div>
                    • {overview.stats.vulnerabilities.critical} critical
                    vulnerabilities
                  </div>
                )}
                {overview.stats.endpoints.nonCompliant > 0 && (
                  <div>
                    • {overview.stats.endpoints.nonCompliant} non-compliant
                    endpoints
                  </div>
                )}
                {hasWindowsIssues && (
                  <div>
                    •{" "}
                    {overview.stats.windows.outdated +
                      overview.stats.windows.unknown}{" "}
                    Windows systems need updates
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview - PROBLEM FOCUSED + Windows */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
          title="Windows Issues"
          value={
            overview.stats.windows.outdated + overview.stats.windows.unknown
          }
          icon="🪟"
          color="blue"
          urgent={hasWindowsIssues}
          subtitle={`${overview.stats.windows.total} total Windows systems`}
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

      {/* Windows Version Summary */}
      {overview.stats.windows.total > 0 && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            🪟 Windows Version Status
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="mb-2 text-3xl font-bold text-green-600">
                {overview.stats.windows.compliant}
              </div>
              <p className="text-sm text-gray-600">Latest Versions</p>
            </div>
            <div className="text-center">
              <div className="mb-2 text-3xl font-bold text-orange-600">
                {overview.stats.windows.outdated}
              </div>
              <p className="text-sm text-gray-600">Need Updates</p>
            </div>
            <div className="text-center">
              <div className="mb-2 text-3xl font-bold text-gray-600">
                {overview.stats.windows.unknown}
              </div>
              <p className="text-sm text-gray-600">Unknown Version</p>
            </div>
          </div>
        </div>
      )}

      {/* Problem Endpoints */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Endpoints Requiring Attention
            </h3>
            <span className="text-sm text-gray-500">
              {endpoints?.endpoints.filter(
                (e: any) =>
                  !e.isCompliant ||
                  e.criticalVulns > 0 ||
                  e.highVulns > 0 ||
                  e.windows?.needsUpdate,
              ).length || 0}{" "}
              of {endpoints?.endpoints.length || 0} have issues
            </span>
          </div>
        </div>
        <div className="p-6">
          {endpoints?.endpoints.length ? (
            <div className="space-y-4">
              {endpoints.endpoints
                .filter(
                  (endpoint: any) =>
                    !endpoint.isCompliant ||
                    endpoint.criticalVulns > 0 ||
                    endpoint.highVulns > 0 ||
                    endpoint.windows?.needsUpdate,
                )
                .map((endpoint: any) => (
                  <EndpointCard
                    key={endpoint.id}
                    endpoint={endpoint}
                    showProblems={true}
                  />
                ))}

              {endpoints.endpoints
                .filter(
                  (endpoint: any) =>
                    endpoint.isCompliant &&
                    endpoint.criticalVulns === 0 &&
                    endpoint.highVulns === 0 &&
                    !endpoint.windows?.needsUpdate,
                )
                .slice(0, 3)
                .map((endpoint: any) => (
                  <EndpointCard
                    key={endpoint.id}
                    endpoint={endpoint}
                    showProblems={false}
                  />
                ))}
            </div>
          ) : (
            <p className="py-8 text-center text-gray-600">
              No endpoints found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function WindowsTab({
  overview,
  windowsSummary,
}: {
  overview: any;
  windowsSummary: any;
}) {
  if (!windowsSummary || windowsSummary.endpoints.length === 0) {
    return (
      <div className="rounded-lg bg-gray-50 py-12 text-center">
        <div className="mb-4 text-6xl">🪟</div>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">
          No Windows Endpoints
        </h2>
        <p className="text-gray-600">
          No Windows systems found in this tenant.
        </p>
      </div>
    );
  }

  const windowsComplianceRate =
    overview.stats.windows.total > 0
      ? Math.round(
          (overview.stats.windows.compliant / overview.stats.windows.total) *
            100,
        )
      : 100;

  return (
    <div className="space-y-8">
      {/* Windows Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-6 text-center">
          <div className="text-3xl font-bold text-blue-600">
            {overview.stats.windows.total}
          </div>
          <div className="text-sm text-gray-600">Total Windows Systems</div>
        </div>
        <div className="rounded-lg border bg-white p-6 text-center">
          <div className="text-3xl font-bold text-green-600">
            {overview.stats.windows.compliant}
          </div>
          <div className="text-sm text-gray-600">Latest Versions</div>
        </div>
        <div className="rounded-lg border bg-white p-6 text-center">
          <div className="text-3xl font-bold text-orange-600">
            {overview.stats.windows.outdated}
          </div>
          <div className="text-sm text-gray-600">Need Updates</div>
        </div>
        <div className="rounded-lg border bg-white p-6 text-center">
          <div className="text-3xl font-bold">{windowsComplianceRate}%</div>
          <div className="text-sm text-gray-600">Compliance Rate</div>
        </div>
      </div>

      {/* Windows Version Breakdown */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">
          Windows Version Breakdown
        </h3>
        <div className="space-y-3">
          {overview.stats.windows.versions.map(
            (version: any, index: number) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <div className="font-medium">{version.displayName}</div>
                  <div className="text-sm text-gray-600">
                    {version.count} systems
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {version.isLatest ? (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                      ✅ Latest
                    </span>
                  ) : (
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-800">
                      ⚠️ Update Available
                    </span>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Detailed Windows Endpoints */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b p-6">
          <h3 className="text-lg font-semibold">Windows Endpoints Detail</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {windowsSummary.endpoints.map((endpoint: any) => (
              <WindowsEndpointCard key={endpoint.id} endpoint={endpoint} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EndpointsTab({ endpoints }: { endpoints: any }) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b p-6">
          <h3 className="text-lg font-semibold">All Endpoints</h3>
        </div>
        <div className="p-6">
          {endpoints?.endpoints.length ? (
            <div className="space-y-4">
              {endpoints.endpoints.map((endpoint: any) => (
                <EndpointCard
                  key={endpoint.id}
                  endpoint={endpoint}
                  showProblems={true}
                  showWindowsDetails={true}
                />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-gray-600">
              No endpoints found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function WindowsEndpointCard({ endpoint }: { endpoint: any }) {
  const needsUpdate = !endpoint.analysis.isLatest && endpoint.osVersion;
  const isStale =
    endpoint.analysis.daysSinceLastSeen !== null &&
    endpoint.analysis.daysSinceLastSeen > 30;

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        needsUpdate || isStale
          ? "border-orange-200 bg-orange-50 hover:bg-orange-100"
          : "border-green-200 bg-green-50 hover:bg-green-100"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{endpoint.hostname}</h4>
            {needsUpdate && <span className="text-orange-500">⚠️</span>}
            {isStale && <span className="text-red-500">🔄</span>}
          </div>
          <p className="text-sm text-gray-600">
            {endpoint.client?.name || "Unassigned"}
          </p>
          <div className="mt-1 space-y-1">
            <p className="text-sm">
              <span className="font-medium">OS:</span>{" "}
              {endpoint.operatingSystem} {endpoint.osVersion}
            </p>
            {endpoint.analysis.recommendedVersion && needsUpdate && (
              <p className="text-sm text-orange-700">
                <span className="font-medium">Recommended:</span>{" "}
                {endpoint.analysis.recommendedVersion}
              </p>
            )}
            <p className="text-xs text-gray-500">
              Last seen:{" "}
              {endpoint.lastSeen
                ? `${endpoint.analysis.daysSinceLastSeen} days ago`
                : "Never"}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              endpoint.analysis.isLatest
                ? "bg-green-100 text-green-800"
                : "bg-orange-100 text-orange-800"
            }`}
          >
            {endpoint.analysis.isLatest ? "✅ Latest" : "⚠️ Update Available"}
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
          </div>
        </div>
      </div>
    </div>
  );
}

function EndpointCard({
  endpoint,
  showProblems,
  showWindowsDetails = false,
}: {
  endpoint: any;
  showProblems: boolean;
  showWindowsDetails?: boolean;
}) {
  const hasProblems =
    !endpoint.isCompliant ||
    endpoint.criticalVulns > 0 ||
    endpoint.highVulns > 0 ||
    endpoint.windows?.needsUpdate;

  const isStale = endpoint.windows?.isStale;

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
            {isStale && (
              <span className="text-gray-500" title="Not seen recently">
                🔄
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">
            {endpoint.client?.name || "Unassigned"} • {endpoint.operatingSystem}
          </p>
          {showWindowsDetails && endpoint.windows?.isWindows && (
            <div className="mt-1">
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                  endpoint.windows.isLatest
                    ? "bg-green-100 text-green-800"
                    : "bg-orange-100 text-orange-800"
                }`}
              >
                🪟{" "}
                {endpoint.windows.isLatest
                  ? "Latest Windows"
                  : "Update Available"}
              </span>
            </div>
          )}
          <p className="text-xs text-gray-500">
            Last seen:{" "}
            {endpoint.lastSeen
              ? endpoint.windows?.daysSinceLastSeen !== null
                ? `${endpoint.windows.daysSinceLastSeen} days ago`
                : new Date(endpoint.lastSeen).toLocaleDateString()
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
            {endpoint.windows?.needsUpdate && (
              <span className="rounded bg-blue-500 px-2 py-1 text-xs font-bold text-white">
                🪟 Update
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
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  urgent?: boolean;
  subtitle?: string;
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
          {subtitle && <p className="mt-1 text-xs text-gray-600">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
