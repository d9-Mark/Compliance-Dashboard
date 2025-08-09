"use client";
// src/app/tenant/[slug]/dashboard/client.tsx - Professional Tenant Dashboard

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
    "overview" | "security" | "compliance" | "endpoints"
  >("overview");
  const [complianceFilter, setComplianceFilter] = useState<
    "all" | "compliant" | "non-compliant"
  >("all");
  const [windowsFilter, setWindowsFilter] = useState<
    "all" | "latest" | "outdated" | "unknown"
  >("all");

  // Get tenant data
  const { data: tenantData } = api.tenant.getAll.useQuery(undefined, {
    enabled: session.user.role === "ADMIN",
    select: (tenants) => tenants.find((t) => t.slug === tenantSlug),
  });

  // Determine the tenant ID for queries
  const queryTenantId =
    session.user.role === "ADMIN" ? tenantData?.id : undefined;

  // Data queries
  const { data: overview, isLoading } = api.tenant.getOverview.useQuery(
    session.user.role === "ADMIN" ? { tenantId: queryTenantId } : {},
    { enabled: session.user.role !== "ADMIN" || !!queryTenantId },
  );

  const { data: endpoints } = api.tenant.getEndpoints.useQuery(
    {
      ...(session.user.role === "ADMIN" ? { tenantId: queryTenantId } : {}),
      limit: 50,
      complianceFilter,
      windowsFilter,
    },
    { enabled: session.user.role !== "ADMIN" || !!queryTenantId },
  );

  const { data: windowsSummary } = api.tenant.getWindowsVersionSummary.useQuery(
    session.user.role === "ADMIN" ? { tenantId: queryTenantId } : {},
    { enabled: session.user.role !== "ADMIN" || !!queryTenantId },
  );

  if (isLoading || (session.user.role === "ADMIN" && !tenantData)) {
    return <LoadingDashboard />;
  }

  if (!overview) {
    return (
      <ErrorState
        tenantSlug={tenantSlug}
        isAdmin={session.user.role === "ADMIN"}
      />
    );
  }

  // Calculate key metrics
  const totalEndpoints = overview.stats.endpoints.total;
  const complianceRate =
    totalEndpoints > 0
      ? Math.round((overview.stats.endpoints.compliant / totalEndpoints) * 100)
      : 0;
  const criticalIssues =
    overview.stats.vulnerabilities.critical +
    overview.stats.endpoints.nonCompliant;
  const windowsComplianceRate =
    overview.stats.windows.total > 0
      ? Math.round(
          (overview.stats.windows.compliant / overview.stats.windows.total) *
            100,
        )
      : 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="border-b bg-white/90 shadow-sm backdrop-blur-md">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600">
                  <span className="text-lg font-bold text-white">
                    {(tenantData?.name || overview.tenant.name).charAt(0)}
                  </span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {tenantData?.name || overview.tenant.name}
                  </h1>
                  <p className="text-sm text-gray-600">
                    Compliance Dashboard • {session.user.name}
                    {session.user.role === "ADMIN" && (
                      <span className="ml-2 rounded-full bg-purple-100 px-2 py-1 text-xs text-purple-800">
                        ADMIN VIEW
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Live Status Indicators */}
              <div className="ml-8 hidden items-center space-x-4 lg:flex">
                <StatusBadge
                  label="Compliance"
                  value={`${complianceRate}%`}
                  status={
                    complianceRate >= 90
                      ? "excellent"
                      : complianceRate >= 70
                        ? "good"
                        : "attention"
                  }
                />
                <StatusBadge
                  label="Windows"
                  value={`${windowsComplianceRate}%`}
                  status={
                    windowsComplianceRate >= 90
                      ? "excellent"
                      : windowsComplianceRate >= 70
                        ? "good"
                        : "attention"
                  }
                />
                {criticalIssues > 0 && (
                  <StatusBadge
                    label="Critical"
                    value={criticalIssues}
                    status="critical"
                    urgent
                  />
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3">
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
      <div className="border-b bg-white/70 backdrop-blur-sm">
        <div className="container mx-auto px-6">
          <nav className="flex space-x-8">
            <TabButton
              active={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
              icon="📊"
              label="Overview"
              badge={criticalIssues > 0 ? criticalIssues : undefined}
              urgent={criticalIssues > 0}
            />
            <TabButton
              active={activeTab === "security"}
              onClick={() => setActiveTab("security")}
              icon="🛡️"
              label="Security & Threats"
              badge={
                overview.stats.vulnerabilities.critical +
                overview.stats.vulnerabilities.high
              }
              urgent={overview.stats.vulnerabilities.critical > 0}
            />
            <TabButton
              active={activeTab === "compliance"}
              onClick={() => setActiveTab("compliance")}
              icon="🪟"
              label="Windows Compliance"
              badge={
                overview.stats.windows.outdated + overview.stats.windows.unknown
              }
              urgent={overview.stats.windows.outdated > 0}
            />
            <TabButton
              active={activeTab === "endpoints"}
              onClick={() => setActiveTab("endpoints")}
              icon="💻"
              label="All Endpoints"
              badge={totalEndpoints}
            />
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        {activeTab === "overview" && (
          <OverviewTab
            overview={overview}
            endpoints={endpoints}
            windowsSummary={windowsSummary}
            complianceRate={complianceRate}
            windowsComplianceRate={windowsComplianceRate}
            criticalIssues={criticalIssues}
          />
        )}

        {activeTab === "security" && (
          <SecurityTab
            overview={overview}
            endpoints={endpoints}
            complianceFilter={complianceFilter}
            setComplianceFilter={setComplianceFilter}
          />
        )}

        {activeTab === "compliance" && (
          <WindowsComplianceTab
            overview={overview}
            windowsSummary={windowsSummary}
            windowsComplianceRate={windowsComplianceRate}
          />
        )}

        {activeTab === "endpoints" && (
          <EndpointsTab
            endpoints={endpoints}
            complianceFilter={complianceFilter}
            windowsFilter={windowsFilter}
            setComplianceFilter={setComplianceFilter}
            setWindowsFilter={setWindowsFilter}
          />
        )}
      </div>
    </div>
  );
}

// Status Badge Component
function StatusBadge({
  label,
  value,
  status,
  urgent,
}: {
  label: string;
  value: string | number;
  status: "excellent" | "good" | "attention" | "critical";
  urgent?: boolean;
}) {
  const statusConfig = {
    excellent: {
      bg: "bg-green-100",
      text: "text-green-700",
      indicator: "bg-green-500",
    },
    good: {
      bg: "bg-blue-100",
      text: "text-blue-700",
      indicator: "bg-blue-500",
    },
    attention: {
      bg: "bg-orange-100",
      text: "text-orange-700",
      indicator: "bg-orange-500",
    },
    critical: {
      bg: "bg-red-100",
      text: "text-red-700",
      indicator: "bg-red-500",
    },
  };

  const config = statusConfig[status];

  return (
    <div
      className={`flex items-center space-x-2 rounded-lg ${config.bg} px-3 py-1.5 ${urgent ? "animate-pulse" : ""}`}
    >
      <div className={`h-2 w-2 rounded-full ${config.indicator}`}></div>
      <div className="text-sm">
        <span className="text-gray-600">{label}:</span>
        <span className={`ml-1 font-semibold ${config.text}`}>{value}</span>
      </div>
    </div>
  );
}

// Tab Button Component
function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
  urgent,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  badge?: number;
  urgent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 border-b-2 px-1 py-4 text-sm font-medium transition-all duration-200 ${
        active
          ? "border-blue-500 text-blue-600"
          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
      }`}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-2 text-xs font-bold ${
            urgent
              ? "animate-pulse bg-red-500 text-white"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// Overview Tab
function OverviewTab({
  overview,
  endpoints,
  windowsSummary,
  complianceRate,
  windowsComplianceRate,
  criticalIssues,
}: any) {
  return (
    <div className="space-y-8">
      {/* Critical Issues Alert */}
      {criticalIssues > 0 && (
        <div className="rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-pink-50 p-6">
          <div className="flex items-start space-x-3">
            <div className="animate-pulse text-2xl">🚨</div>
            <div>
              <h3 className="font-semibold text-red-900">
                Critical Issues Require Attention
              </h3>
              <div className="mt-2 space-y-1 text-sm text-red-800">
                {overview.stats.vulnerabilities.critical > 0 && (
                  <p>
                    • {overview.stats.vulnerabilities.critical} critical
                    vulnerabilities detected
                  </p>
                )}
                {overview.stats.endpoints.nonCompliant > 0 && (
                  <p>
                    • {overview.stats.endpoints.nonCompliant} non-compliant
                    endpoints
                  </p>
                )}
                {overview.stats.windows.outdated > 0 && (
                  <p>
                    • {overview.stats.windows.outdated} Windows systems need
                    updates
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Overall Compliance"
          value={`${complianceRate}%`}
          subtitle={`${overview.stats.endpoints.compliant} of ${overview.stats.endpoints.total} endpoints`}
          icon="🎯"
          color={
            complianceRate >= 90
              ? "green"
              : complianceRate >= 70
                ? "orange"
                : "red"
          }
          trend={
            complianceRate >= 90
              ? "excellent"
              : complianceRate >= 70
                ? "good"
                : "needs-attention"
          }
        />
        <MetricCard
          title="Critical Threats"
          value={overview.stats.vulnerabilities.critical}
          subtitle={`${overview.stats.vulnerabilities.high} high priority`}
          icon="🚨"
          color={
            overview.stats.vulnerabilities.critical === 0 ? "green" : "red"
          }
          urgent={overview.stats.vulnerabilities.critical > 0}
        />
        <MetricCard
          title="Windows Compliance"
          value={`${windowsComplianceRate}%`}
          subtitle={`${overview.stats.windows.compliant} of ${overview.stats.windows.total} up to date`}
          icon="🪟"
          color={
            windowsComplianceRate >= 90
              ? "green"
              : windowsComplianceRate >= 70
                ? "orange"
                : "red"
          }
        />
        <MetricCard
          title="Total Endpoints"
          value={overview.stats.endpoints.total}
          subtitle={`${overview.stats.endpoints.stale || 0} haven't reported recently`}
          icon="💻"
          color="blue"
        />
      </div>

      {/* Windows Version Health */}
      {overview.stats.windows.total > 0 && (
        <div className="rounded-xl bg-white/80 p-6 shadow-lg backdrop-blur-sm">
          <h3 className="mb-6 flex items-center space-x-2 text-lg font-semibold">
            <span>🪟</span>
            <span>Windows Version Health</span>
          </h3>

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <div className="mb-1 text-3xl font-bold text-green-600">
                {overview.stats.windows.compliant}
              </div>
              <p className="text-sm font-medium text-green-700">
                Latest Versions
              </p>
              <p className="text-xs text-gray-600">Fully supported & secure</p>
            </div>
            <div className="rounded-lg bg-orange-50 p-4 text-center">
              <div className="mb-1 text-3xl font-bold text-orange-600">
                {overview.stats.windows.outdated}
              </div>
              <p className="text-sm font-medium text-orange-700">
                Need Updates
              </p>
              <p className="text-xs text-gray-600">Security risk</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <div className="mb-1 text-3xl font-bold text-gray-600">
                {overview.stats.windows.unknown}
              </div>
              <p className="text-sm font-medium text-gray-700">
                Unknown Version
              </p>
              <p className="text-xs text-gray-600">Requires investigation</p>
            </div>
          </div>

          {/* Version Breakdown */}
          <div className="space-y-3">
            {overview.stats.windows.versions.map(
              (version: any, index: number) => (
                <div
                  key={index}
                  className={`flex items-center justify-between rounded-lg border p-4 ${
                    version.isLatest
                      ? "border-green-200 bg-green-50"
                      : "border-orange-200 bg-orange-50"
                  }`}
                >
                  <div>
                    <div className="font-medium">{version.displayName}</div>
                    <div className="text-sm text-gray-600">
                      {version.count} systems
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${
                        version.isLatest
                          ? "bg-green-100 text-green-800"
                          : "bg-orange-100 text-orange-800"
                      }`}
                    >
                      {version.isLatest ? "✅ Latest" : "⚠️ Update Available"}
                    </span>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {/* Recent Endpoints Activity */}
      <div className="rounded-xl bg-white/80 p-6 shadow-lg backdrop-blur-sm">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Endpoints Requiring Attention
          </h3>
          <span className="text-sm text-gray-500">
            {endpoints?.endpoints?.filter(
              (e: any) =>
                !e.isCompliant ||
                e.criticalVulns > 0 ||
                e.highVulns > 0 ||
                e.windows?.needsUpdate,
            ).length || 0}{" "}
            of {endpoints?.endpoints?.length || 0} need action
          </span>
        </div>

        {endpoints?.endpoints?.length ? (
          <div className="space-y-3">
            {endpoints.endpoints
              .filter(
                (endpoint: any) =>
                  !endpoint.isCompliant ||
                  endpoint.criticalVulns > 0 ||
                  endpoint.highVulns > 0 ||
                  endpoint.windows?.needsUpdate,
              )
              .slice(0, 10)
              .map((endpoint: any) => (
                <PriorityEndpointCard key={endpoint.id} endpoint={endpoint} />
              ))}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">
            <div className="mb-2 text-4xl">✅</div>
            <p>All endpoints are compliant!</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Security Tab
function SecurityTab({
  overview,
  endpoints,
  complianceFilter,
  setComplianceFilter,
}: any) {
  const totalVulns =
    overview.stats.vulnerabilities.critical +
    overview.stats.vulnerabilities.high +
    overview.stats.vulnerabilities.medium +
    overview.stats.vulnerabilities.low;

  return (
    <div className="space-y-8">
      {/* Security Summary */}
      <div className="grid gap-6 md:grid-cols-4">
        <ThreatLevelCard
          level="Critical"
          count={overview.stats.vulnerabilities.critical}
          color="red"
          icon="🚨"
          description="Immediate action required"
        />
        <ThreatLevelCard
          level="High"
          count={overview.stats.vulnerabilities.high}
          color="orange"
          icon="⚠️"
          description="Address within 24-48 hours"
        />
        <ThreatLevelCard
          level="Medium"
          count={overview.stats.vulnerabilities.medium}
          color="yellow"
          icon="⚡"
          description="Schedule for remediation"
        />
        <ThreatLevelCard
          level="Low"
          count={overview.stats.vulnerabilities.low}
          color="blue"
          icon="📋"
          description="Monitor and patch cycles"
        />
      </div>

      {/* Security Filter */}
      <div className="rounded-xl bg-white/80 p-6 shadow-lg backdrop-blur-sm">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Security Status by Endpoint</h3>
          <select
            value={complianceFilter}
            onChange={(e) => setComplianceFilter(e.target.value as any)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="all">All Endpoints</option>
            <option value="non-compliant">Non-Compliant Only</option>
            <option value="compliant">Compliant Only</option>
          </select>
        </div>

        {endpoints?.endpoints?.length ? (
          <div className="space-y-3">
            {endpoints.endpoints.map((endpoint: any) => (
              <SecurityEndpointCard key={endpoint.id} endpoint={endpoint} />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">
            <p>No endpoints match the current filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Windows Compliance Tab
function WindowsComplianceTab({
  overview,
  windowsSummary,
  windowsComplianceRate,
}: any) {
  if (!windowsSummary || windowsSummary.endpoints.length === 0) {
    return (
      <div className="rounded-xl bg-gray-50 py-12 text-center">
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

  return (
    <div className="space-y-8">
      {/* Windows Compliance Summary */}
      <div className="grid gap-6 md:grid-cols-4">
        <WindowsMetricCard
          title="Total Windows"
          value={overview.stats.windows.total}
          icon="🪟"
          color="blue"
        />
        <WindowsMetricCard
          title="Latest Versions"
          value={overview.stats.windows.compliant}
          icon="✅"
          color="green"
        />
        <WindowsMetricCard
          title="Need Updates"
          value={overview.stats.windows.outdated}
          icon="⚠️"
          color="orange"
          urgent={overview.stats.windows.outdated > 0}
        />
        <WindowsMetricCard
          title="Compliance Rate"
          value={`${windowsComplianceRate}%`}
          icon="📊"
          color={
            windowsComplianceRate >= 90
              ? "green"
              : windowsComplianceRate >= 70
                ? "orange"
                : "red"
          }
        />
      </div>

      {/* Detailed Windows Endpoints */}
      <div className="rounded-xl bg-white/80 p-6 shadow-lg backdrop-blur-sm">
        <h3 className="mb-6 text-lg font-semibold">Windows Systems Detail</h3>
        <div className="space-y-3">
          {windowsSummary.endpoints.map((endpoint: any) => (
            <WindowsEndpointCard key={endpoint.id} endpoint={endpoint} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Endpoints Tab
function EndpointsTab({
  endpoints,
  complianceFilter,
  windowsFilter,
  setComplianceFilter,
  setWindowsFilter,
}: any) {
  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-xl bg-white/80 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center space-x-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Compliance Status
            </label>
            <select
              value={complianceFilter}
              onChange={(e) => setComplianceFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              <option value="all">All Endpoints</option>
              <option value="compliant">Compliant Only</option>
              <option value="non-compliant">Non-Compliant Only</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Windows Version
            </label>
            <select
              value={windowsFilter}
              onChange={(e) => setWindowsFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              <option value="all">All Windows Versions</option>
              <option value="latest">Latest Only</option>
              <option value="outdated">Outdated Only</option>
              <option value="unknown">Unknown Version</option>
            </select>
          </div>
        </div>
      </div>

      {/* Endpoints List */}
      <div className="rounded-xl bg-white/80 p-6 shadow-lg backdrop-blur-sm">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold">All Endpoints</h3>
          <span className="text-sm text-gray-500">
            {endpoints?.endpoints?.length || 0} endpoints
          </span>
        </div>

        {endpoints?.endpoints?.length ? (
          <div className="space-y-3">
            {endpoints.endpoints.map((endpoint: any) => (
              <DetailedEndpointCard key={endpoint.id} endpoint={endpoint} />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">
            <p>No endpoints match the current filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components
function LoadingDashboard() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
        <p className="text-lg text-gray-600">Loading dashboard...</p>
      </div>
    </div>
  );
}

function ErrorState({
  tenantSlug,
  isAdmin,
}: {
  tenantSlug: string;
  isAdmin: boolean;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-4 text-6xl">⚠️</div>
        <h1 className="mb-4 text-2xl font-bold text-red-600">
          {isAdmin ? "Tenant Not Found" : "Access Denied"}
        </h1>
        <p className="mb-4 text-gray-600">
          {isAdmin
            ? `No tenant found with slug '${tenantSlug}' or you don't have access.`
            : "Unable to load tenant data or insufficient permissions."}
        </p>
        <Link
          href={isAdmin ? "/admin/dashboard" : "/auth/signin"}
          className="text-blue-600 hover:underline"
        >
          {isAdmin ? "← Back to Admin Dashboard" : "Sign in again"}
        </Link>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  color,
  trend,
  urgent,
}: any) {
  const colorClasses = {
    blue: "from-blue-500 to-blue-600",
    green: "from-green-500 to-green-600",
    orange: "from-orange-500 to-orange-600",
    red: "from-red-500 to-red-600",
    purple: "from-purple-500 to-purple-600",
  };

  return (
    <div
      className={`rounded-xl bg-gradient-to-br ${colorClasses[color]} transform p-6 text-white shadow-lg transition-all duration-200 hover:scale-105 ${urgent ? "animate-pulse" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white/80">{title}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
          {subtitle && <p className="mt-1 text-sm text-white/70">{subtitle}</p>}
          {trend && (
            <p className="mt-1 text-xs text-white/60">
              {trend === "excellent"
                ? "🎯 Excellent"
                : trend === "good"
                  ? "👍 Good"
                  : "⚠️ Needs Attention"}
            </p>
          )}
        </div>
        <div className="text-3xl opacity-80">{icon}</div>
      </div>
    </div>
  );
}

function ThreatLevelCard({ level, count, color, icon, description }: any) {
  const colorClasses = {
    red: "border-red-200 bg-red-50 text-red-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    yellow: "border-yellow-200 bg-yellow-50 text-yellow-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  };

  return (
    <div
      className={`rounded-xl border p-6 ${colorClasses[color]} ${count > 0 && color === "red" ? "animate-pulse" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <div className="text-right">
          <div className="text-2xl font-bold">{count}</div>
          <div className="text-sm font-medium">{level}</div>
        </div>
      </div>
      <p className="text-sm">{description}</p>
    </div>
  );
}

function WindowsMetricCard({ title, value, icon, color, urgent }: any) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    orange: "bg-orange-50 border-orange-200",
    red: "bg-red-50 border-red-200",
  };

  return (
    <div
      className={`rounded-xl border p-6 ${colorClasses[color]} ${urgent ? "animate-pulse" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  );
}

function PriorityEndpointCard({ endpoint }: any) {
  const hasProblems =
    !endpoint.isCompliant ||
    endpoint.criticalVulns > 0 ||
    endpoint.highVulns > 0 ||
    endpoint.windows?.needsUpdate;

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${hasProblems ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <h4 className="font-medium">{endpoint.hostname}</h4>
            {hasProblems && <span className="text-red-500">⚠️</span>}
          </div>
          <p className="text-sm text-gray-600">
            {endpoint.operatingSystem} • {endpoint.client?.name || "Unassigned"}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {endpoint.criticalVulns > 0 && (
            <span className="rounded bg-red-500 px-2 py-1 text-xs font-bold text-white">
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
        </div>
      </div>
    </div>
  );
}

function SecurityEndpointCard({ endpoint }: any) {
  return (
    <div
      className={`rounded-lg border p-4 ${endpoint.isCompliant ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">{endpoint.hostname}</h4>
          <p className="text-sm text-gray-600">{endpoint.operatingSystem}</p>
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${endpoint.isCompliant ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
          >
            {endpoint.isCompliant ? "✅ Secure" : "❌ Issues"}
          </span>
          <div className="text-right text-sm">
            <div>
              C:{endpoint.criticalVulns} H:{endpoint.highVulns}
            </div>
            <div>
              M:{endpoint.mediumVulns} L:{endpoint.lowVulns}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WindowsEndpointCard({ endpoint }: any) {
  const needsUpdate = !endpoint.analysis.isLatest;

  return (
    <div
      className={`rounded-lg border p-4 ${needsUpdate ? "border-orange-200 bg-orange-50" : "border-green-200 bg-green-50"}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">{endpoint.hostname}</h4>
          <p className="text-sm text-gray-600">
            {endpoint.operatingSystem} {endpoint.osVersion}
          </p>
          {endpoint.analysis.recommendedVersion && needsUpdate && (
            <p className="text-sm text-orange-700">
              Recommended: {endpoint.analysis.recommendedVersion}
            </p>
          )}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${endpoint.analysis.isLatest ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}`}
        >
          {endpoint.analysis.isLatest ? "✅ Latest" : "⚠️ Update Available"}
        </span>
      </div>
    </div>
  );
}

function DetailedEndpointCard({ endpoint }: any) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">{endpoint.hostname}</h4>
          <p className="text-sm text-gray-600">
            {endpoint.operatingSystem} • {endpoint.client?.name || "Unassigned"}
          </p>
          <p className="text-xs text-gray-500">
            Last seen:{" "}
            {endpoint.lastSeen
              ? new Date(endpoint.lastSeen).toLocaleDateString()
              : "Never"}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${endpoint.isCompliant ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
          >
            {endpoint.isCompliant ? "✅ Compliant" : "❌ Issues"}
          </span>
          <div className="text-right text-xs text-gray-500">
            C:{endpoint.criticalVulns} H:{endpoint.highVulns} M:
            {endpoint.mediumVulns} L:{endpoint.lowVulns}
          </div>
        </div>
      </div>
    </div>
  );
}
