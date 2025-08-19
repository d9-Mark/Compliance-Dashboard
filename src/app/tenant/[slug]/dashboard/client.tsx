// RESTORED WORKING DASHBOARD - src/app/tenant/[slug]/dashboard/enhanced-client.tsx
"use client";

import { api } from "~/trpc/react";
import type { Session } from "next-auth";
import Link from "next/link";
import { useState } from "react";

interface EnhancedTenantDashboardProps {
  session: Session;
  tenantSlug: string;
}

export function EnhancedTenantDashboard({
  session,
  tenantSlug,
}: EnhancedTenantDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "security" | "compliance" | "endpoints" | "vulnerabilities"
  >("overview");
  const [complianceFilter, setComplianceFilter] = useState<
    "all" | "compliant" | "non-compliant"
  >("all");
  const [windowsFilter, setWindowsFilter] = useState<
    "all" | "latest" | "outdated" | "unknown"
  >("all");

  // Get tenant data (ORIGINAL WORKING QUERY)
  const { data: tenantData } = api.tenant.getAll.useQuery(undefined, {
    enabled: session.user.role === "ADMIN",
    select: (tenants) => tenants.find((t) => t.slug === tenantSlug),
  });

  // Determine the tenant ID for queries
  const queryTenantId =
    session.user.role === "ADMIN" ? tenantData?.id : undefined;

  // ORIGINAL WORKING DATA QUERIES - RESTORED
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

  // ENHANCED QUERIES - NOW ENABLED!
  const { data: criticalVulnDetails, isLoading: vulnLoading } =
    api.tenant.getCriticalVulnerabilityDetails.useQuery(
      {
        ...(session.user.role === "ADMIN" ? { tenantId: queryTenantId } : {}),
        severityFilter: "CRITICAL_AND_HIGH",
        hideD9Managed: false, // Start with false, can be toggled by admin
      },
      { enabled: session.user.role !== "ADMIN" || !!queryTenantId },
    );

  // Vulnerability trends
  const { data: vulnerabilityTrends } =
    api.tenant.getVulnerabilityTrends.useQuery(
      {
        ...(session.user.role === "ADMIN" ? { tenantId: queryTenantId } : {}),
        days: 30,
      },
      { enabled: session.user.role !== "ADMIN" || !!queryTenantId },
    );

  // D9 managed apps (admin only)
  const { data: d9Apps } = api.tenant.getD9ManagedApps.useQuery(undefined, {
    enabled: session.user.role === "ADMIN",
  });

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

  // Calculate key metrics (ORIGINAL WORKING CALCULATIONS)
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
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Professional Header */}
      <div className="bg-white/80 shadow-sm backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {tenantData?.name || overview.tenant.name}
              </h1>
              <p className="text-gray-600">Security & Compliance Dashboard</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Last Updated</div>
              <div className="font-medium">
                {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex space-x-1 rounded-lg bg-white/60 p-1 backdrop-blur-sm">
          {(
            [
              "overview",
              "security",
              "compliance",
              "endpoints",
              "vulnerabilities",
            ] as const
          ).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="mx-auto max-w-7xl px-4 pb-8">
        {activeTab === "overview" && (
          <OverviewTab
            overview={overview}
            complianceRate={complianceRate}
            criticalIssues={criticalIssues}
            windowsComplianceRate={windowsComplianceRate}
            endpoints={endpoints}
            criticalVulnDetails={criticalVulnDetails}
            vulnerabilityTrends={vulnerabilityTrends}
          />
        )}
        {activeTab === "security" && (
          <SecurityTab overview={overview} endpoints={endpoints} />
        )}
        {activeTab === "compliance" && (
          <ComplianceTab
            overview={overview}
            windowsSummary={windowsSummary}
            windowsComplianceRate={windowsComplianceRate}
          />
        )}
        {activeTab === "endpoints" && (
          <EndpointsTab
            endpoints={endpoints}
            complianceFilter={complianceFilter}
            setComplianceFilter={setComplianceFilter}
            windowsFilter={windowsFilter}
            setWindowsFilter={setWindowsFilter}
          />
        )}
        {activeTab === "vulnerabilities" && (
          <VulnerabilitiesTab
            overview={overview}
            endpoints={endpoints}
            criticalVulnDetails={criticalVulnDetails}
            isLoading={vulnLoading}
            hideD9Managed={false}
            isAdmin={session.user.role === "ADMIN"}
          />
        )}
      </div>
    </div>
  );
}

/* Overview Tab - ENHANCED WITH VULNERABILITY DETAILS */
function OverviewTab({
  overview,
  complianceRate,
  criticalIssues,
  windowsComplianceRate,
  endpoints,
  criticalVulnDetails,
  vulnerabilityTrends,
}: any) {
  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Endpoints"
          value={overview.stats.endpoints.total}
          icon="💻"
          color="blue"
        />
        <MetricCard
          title="Compliance Rate"
          value={`${complianceRate}%`}
          icon="✅"
          color={
            complianceRate >= 80
              ? "green"
              : complianceRate >= 60
                ? "orange"
                : "red"
          }
          trend={
            vulnerabilityTrends?.summary?.netChange > 0
              ? "up"
              : vulnerabilityTrends?.summary?.netChange < 0
                ? "down"
                : "stable"
          }
        />
        <MetricCard
          title="Critical Issues"
          value={criticalIssues}
          icon="🚨"
          color={criticalIssues === 0 ? "green" : "red"}
        />
        <MetricCard
          title="Windows Compliance"
          value={`${windowsComplianceRate}%`}
          icon="🪟"
          color={
            windowsComplianceRate >= 80
              ? "green"
              : windowsComplianceRate >= 60
                ? "orange"
                : "red"
          }
        />
      </div>

      {/* Enhanced: Most Vulnerable Apps */}
      {criticalVulnDetails?.summary?.mostVulnerableApps?.length > 0 && (
        <div className="rounded-xl bg-white/80 p-6 shadow-lg backdrop-blur-sm">
          <h3 className="mb-4 text-lg font-semibold">
            🎯 Most Vulnerable Applications
          </h3>
          <div className="space-y-3">
            {criticalVulnDetails.summary.mostVulnerableApps
              .slice(0, 5)
              .map((app: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50"
                >
                  <div>
                    <div className="font-medium">{app.appName}</div>
                    <div className="text-sm text-gray-600">
                      Affects {app.affectedEndpointsCount} machine
                      {app.affectedEndpointsCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {app.criticalCount > 0 && (
                      <span className="rounded bg-red-500 px-3 py-1 text-xs font-bold text-white">
                        🚨 {app.criticalCount} Critical
                      </span>
                    )}
                    {app.highCount > 0 && (
                      <span className="rounded bg-orange-500 px-3 py-1 text-xs font-bold text-white">
                        ⚠️ {app.highCount} High
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                // This would switch to vulnerabilities tab
                window.dispatchEvent(
                  new CustomEvent("switchTab", { detail: "vulnerabilities" }),
                );
              }}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View All Vulnerable Applications →
            </button>
          </div>
        </div>
      )}

      {/* Vulnerability Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white/80 p-6 shadow-lg backdrop-blur-sm">
          <h3 className="mb-4 text-lg font-semibold">Vulnerability Overview</h3>
          <div className="space-y-3">
            <VulnBar
              label="Critical"
              count={overview.stats.vulnerabilities.critical}
              color="bg-red-500"
            />
            <VulnBar
              label="High"
              count={overview.stats.vulnerabilities.high}
              color="bg-orange-500"
            />
            <VulnBar
              label="Medium"
              count={overview.stats.vulnerabilities.medium}
              color="bg-yellow-500"
            />
            <VulnBar
              label="Low"
              count={overview.stats.vulnerabilities.low}
              color="bg-blue-500"
            />
          </div>
        </div>

        <div className="rounded-xl bg-white/80 p-6 shadow-lg backdrop-blur-sm">
          <h3 className="mb-4 text-lg font-semibold">Windows Version Status</h3>
          <div className="space-y-3">
            <StatRow
              label="Total Windows Systems"
              value={overview.stats.windows.total}
            />
            <StatRow
              label="Compliant Systems"
              value={overview.stats.windows.compliant}
              valueColor="text-green-600"
            />
            <StatRow
              label="Outdated Systems"
              value={overview.stats.windows.outdated}
              valueColor="text-orange-600"
            />
            <StatRow
              label="Unknown Versions"
              value={overview.stats.windows.unknown}
              valueColor="text-gray-600"
            />
          </div>
        </div>
      </div>

      {/* Endpoints Requiring Attention */}
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
                (e: any) =>
                  !e.isCompliant ||
                  e.criticalVulns > 0 ||
                  e.highVulns > 0 ||
                  e.windows?.needsUpdate,
              )
              .slice(0, 10)
              .map((endpoint: any) => (
                <EndpointCard key={endpoint.id} endpoint={endpoint} />
              ))}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">
            🎉 All endpoints are compliant and secure!
          </div>
        )}
      </div>
    </div>
  );
}

/* Security Tab - RESTORED */
function SecurityTab({ overview, endpoints }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Security Overview</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white/80 p-6 shadow-lg backdrop-blur-sm">
          <h3 className="mb-4 text-lg font-semibold">Security Metrics</h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span>Infected Endpoints</span>
              <span className="font-semibold text-red-600">
                {endpoints?.endpoints?.filter((e: any) => e.isInfected)
                  .length || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Active Threats</span>
              <span className="font-semibold text-orange-600">
                {endpoints?.endpoints?.reduce(
                  (sum: number, e: any) => sum + (e.activeThreats || 0),
                  0,
                ) || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Missing Patches</span>
              <span className="font-semibold text-yellow-600">
                {endpoints?.endpoints?.filter(
                  (e: any) => e.windows?.needsUpdate,
                ).length || 0}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white/80 p-6 shadow-lg backdrop-blur-sm">
          <h3 className="mb-4 text-lg font-semibold">
            Most Vulnerable Endpoints
          </h3>
          <div className="space-y-2">
            {endpoints?.endpoints
              ?.sort(
                (a: any, b: any) =>
                  b.criticalVulns +
                  b.highVulns -
                  (a.criticalVulns + a.highVulns),
              )
              .slice(0, 5)
              .map((endpoint: any) => (
                <div
                  key={endpoint.id}
                  className="flex items-center justify-between rounded border p-2"
                >
                  <span className="font-medium">{endpoint.hostname}</span>
                  <div className="flex space-x-2">
                    {endpoint.criticalVulns > 0 && (
                      <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">
                        {endpoint.criticalVulns} Critical
                      </span>
                    )}
                    {endpoint.highVulns > 0 && (
                      <span className="rounded bg-orange-100 px-2 py-1 text-xs text-orange-800">
                        {endpoint.highVulns} High
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Compliance Tab - RESTORED */
function ComplianceTab({
  overview,
  windowsSummary,
  windowsComplianceRate,
}: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Compliance Status</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white/80 p-6 shadow-lg backdrop-blur-sm">
          <h3 className="mb-4 text-lg font-semibold">Overall Compliance</h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span>Compliant Endpoints</span>
              <span className="font-semibold text-green-600">
                {overview.stats.endpoints.compliant}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Non-Compliant Endpoints</span>
              <span className="font-semibold text-red-600">
                {overview.stats.endpoints.nonCompliant}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Windows Compliance Rate</span>
              <span
                className={`font-semibold ${windowsComplianceRate >= 80 ? "text-green-600" : "text-red-600"}`}
              >
                {windowsComplianceRate}%
              </span>
            </div>
          </div>
        </div>

        {windowsSummary && (
          <div className="rounded-xl bg-white/80 p-6 shadow-lg backdrop-blur-sm">
            <h3 className="mb-4 text-lg font-semibold">
              Windows Version Distribution
            </h3>
            <div className="space-y-2">
              {overview.stats.windows.versions?.map(
                (version: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded border p-2"
                  >
                    <span>{version.displayName}</span>
                    <span className="font-medium">{version.count}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* Endpoints Tab - RESTORED */
function EndpointsTab({
  endpoints,
  complianceFilter,
  setComplianceFilter,
  windowsFilter,
  setWindowsFilter,
}: any) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Endpoint Management</h2>
        <div className="flex space-x-3">
          <select
            value={complianceFilter}
            onChange={(e) => setComplianceFilter(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1 text-sm"
          >
            <option value="all">All Endpoints</option>
            <option value="compliant">Compliant Only</option>
            <option value="non-compliant">Non-Compliant Only</option>
          </select>
          <select
            value={windowsFilter}
            onChange={(e) => setWindowsFilter(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1 text-sm"
          >
            <option value="all">All Windows Versions</option>
            <option value="latest">Latest Versions</option>
            <option value="outdated">Outdated Versions</option>
            <option value="unknown">Unknown Versions</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white/80 shadow-lg backdrop-blur-sm">
        <div className="divide-y divide-gray-200">
          {endpoints?.endpoints?.map((endpoint: any) => (
            <EndpointDetailCard key={endpoint.id} endpoint={endpoint} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* Enhanced Vulnerabilities Tab - FULLY FUNCTIONAL */
function VulnerabilitiesTab({
  overview,
  endpoints,
  criticalVulnDetails,
  isLoading,
  hideD9Managed,
  isAdmin,
}: any) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="mb-4 text-4xl">🔍</div>
          <h3 className="mb-2 text-lg font-semibold">
            Analyzing Vulnerabilities...
          </h3>
          <p className="text-gray-600">
            Loading detailed vulnerability data by machine and application
          </p>
        </div>
      </div>
    );
  }

  if (!criticalVulnDetails?.endpoints?.length) {
    return (
      <div className="space-y-6">
        {/* Still show summary even with no critical vulns */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-white/80 p-6 shadow-lg backdrop-blur-sm">
            <h3 className="mb-4 text-lg font-semibold">
              Vulnerability Breakdown
            </h3>
            <div className="space-y-3">
              <VulnBar
                label="Critical Vulnerabilities"
                count={overview.stats.vulnerabilities.critical}
                color="bg-red-500"
              />
              <VulnBar
                label="High Vulnerabilities"
                count={overview.stats.vulnerabilities.high}
                color="bg-orange-500"
              />
              <VulnBar
                label="Medium Vulnerabilities"
                count={overview.stats.vulnerabilities.medium}
                color="bg-yellow-500"
              />
              <VulnBar
                label="Low Vulnerabilities"
                count={overview.stats.vulnerabilities.low}
                color="bg-blue-500"
              />
            </div>
          </div>

          <div className="rounded-xl bg-white/80 p-8 text-center shadow-lg backdrop-blur-sm">
            <div className="mb-4 text-4xl">🎉</div>
            <h3 className="mb-2 text-lg font-semibold text-green-600">
              No Critical/High Vulnerabilities Found!
            </h3>
            <p className="text-gray-600">
              {hideD9Managed && isAdmin
                ? "No critical/high vulnerabilities in non-D9 managed applications."
                : "Your systems are secure from critical and high-risk vulnerabilities."}
            </p>
            {overview.stats.vulnerabilities.medium > 0 && (
              <p className="mt-2 text-sm text-yellow-600">
                ⚠️ You still have {overview.stats.vulnerabilities.medium}{" "}
                medium-risk vulnerabilities to review
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Affected Machines"
          value={criticalVulnDetails.summary.totalEndpointsAffected}
          icon="💻"
          color="red"
        />
        <MetricCard
          title="Critical Vulnerabilities"
          value={criticalVulnDetails.summary.totalCriticalVulns}
          icon="🚨"
          color="red"
        />
        <MetricCard
          title="High Risk Vulnerabilities"
          value={criticalVulnDetails.summary.totalHighVulns}
          icon="⚠️"
          color="orange"
        />
        <MetricCard
          title="Vulnerable Apps"
          value={criticalVulnDetails.summary.mostVulnerableApps?.length || 0}
          icon="📱"
          color="purple"
        />
      </div>

      {/* Filter Information */}
      {hideD9Managed &&
        isAdmin &&
        criticalVulnDetails.d9ManagedAppsHidden > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center">
              <div className="mr-2 text-blue-600">ℹ️</div>
              <div className="text-blue-800">
                Hiding {criticalVulnDetails.d9ManagedAppsHidden} D9-managed
                applications from results.
                <button className="ml-2 text-sm text-blue-600 underline hover:text-blue-700">
                  Manage D9 Apps →
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Machine-by-Machine Breakdown */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          🖥️ Machines Requiring Immediate Attention
        </h3>
        {criticalVulnDetails.endpoints.map((endpointData: any) => (
          <EndpointVulnerabilityCard
            key={endpointData.endpoint.id}
            data={endpointData}
          />
        ))}
      </div>
    </div>
  );
}

/* Helper Components - RESTORED */
function MetricCard({ title, value, icon, color }: any) {
  const colorClasses = {
    red: "bg-red-50 border-red-200 text-red-800",
    orange: "bg-orange-50 border-orange-200 text-orange-800",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-800",
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    purple: "bg-purple-50 border-purple-200 text-purple-800",
    green: "bg-green-50 border-green-200 text-green-800",
  };

  return (
    <div
      className={`rounded-xl border p-6 ${colorClasses[color] || colorClasses.blue}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
    </div>
  );
}

function VulnBar({ label, count, color }: any) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center space-x-2">
        <div className={`h-2 w-16 rounded ${color} opacity-60`}></div>
        <span className="font-semibold">{count}</span>
      </div>
    </div>
  );
}

function StatRow({ label, value, valueColor = "text-gray-900" }: any) {
  return (
    <div className="flex justify-between">
      <span className="text-sm">{label}</span>
      <span className={`font-semibold ${valueColor}`}>{value}</span>
    </div>
  );
}

function EndpointCard({ endpoint }: any) {
  const hasProblems =
    !endpoint.isCompliant ||
    endpoint.criticalVulns > 0 ||
    endpoint.highVulns > 0;

  return (
    <div
      className={`rounded-lg border p-4 ${hasProblems ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}
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

/* Individual Endpoint Vulnerability Card - ENHANCED */
function EndpointVulnerabilityCard({ data }: { data: any }) {
  const [expanded, setExpanded] = useState(false);
  const { endpoint, vulnerableApps, totalCritical, totalHigh } = data;

  return (
    <div className="overflow-hidden rounded-xl bg-white/80 shadow-lg backdrop-blur-sm">
      {/* Header */}
      <div
        className="cursor-pointer p-6 transition-colors hover:bg-gray-50/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <h4 className="text-lg font-semibold">{endpoint.hostname}</h4>
              <div className="flex items-center space-x-2">
                {totalCritical > 0 && (
                  <span className="rounded bg-red-500 px-3 py-1 text-sm font-bold text-white">
                    🚨 {totalCritical} Critical
                  </span>
                )}
                {totalHigh > 0 && (
                  <span className="rounded bg-orange-500 px-3 py-1 text-sm font-bold text-white">
                    ⚠️ {totalHigh} High
                  </span>
                )}
              </div>
            </div>
            <div className="mt-1 text-sm text-gray-600">
              {endpoint.operatingSystem} •{" "}
              {endpoint.client?.name || "Unassigned"} •{vulnerableApps.length}{" "}
              vulnerable app{vulnerableApps.length !== 1 ? "s" : ""} • Last
              seen:{" "}
              {endpoint.lastSeen
                ? new Date(endpoint.lastSeen).toLocaleDateString()
                : "Never"}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right text-xs text-gray-500">
              Click to {expanded ? "collapse" : "expand"}
            </div>
            <div className="text-lg text-gray-400">{expanded ? "▼" : "▶"}</div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t bg-gray-50/50 px-6 py-4">
          <h5 className="mb-4 font-medium text-gray-900">
            📱 Vulnerable Applications on this machine:
          </h5>
          <div className="space-y-4">
            {vulnerableApps.map((app: any, idx: number) => (
              <div
                key={idx}
                className="rounded-lg border bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-medium text-gray-900">{app.appName}</div>
                  <div className="flex items-center space-x-2">
                    {app.criticalCount > 0 && (
                      <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                        {app.criticalCount} Critical
                      </span>
                    )}
                    {app.highCount > 0 && (
                      <span className="rounded bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800">
                        {app.highCount} High
                      </span>
                    )}
                  </div>
                </div>

                {/* Individual Vulnerabilities */}
                <div className="space-y-2">
                  {app.vulnerabilities
                    .slice(0, 3)
                    .map((vuln: any, vIdx: number) => (
                      <div
                        key={vIdx}
                        className="border-l-2 border-gray-200 pl-3 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {vuln.cveId || vuln.title?.substring(0, 50) + "..."}
                          </span>
                          <span
                            className={`rounded px-2 py-1 text-xs font-medium ${
                              vuln.severity === "CRITICAL"
                                ? "bg-red-100 text-red-800"
                                : "bg-orange-100 text-orange-800"
                            }`}
                          >
                            {vuln.severity}{" "}
                            {vuln.cvssScore && `(${vuln.cvssScore})`}
                          </span>
                        </div>
                        {vuln.version && (
                          <div className="mt-1 text-gray-600">
                            Version: {vuln.version}
                          </div>
                        )}
                        <div className="mt-1 text-xs text-gray-500">
                          Detected:{" "}
                          {new Date(vuln.detectedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  {app.vulnerabilities.length > 3 && (
                    <div className="pl-3 text-sm font-medium text-blue-600">
                      ... and {app.vulnerabilities.length - 3} more
                      vulnerabilities in this application
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      💡 Action needed: Update{" "}
                      {app.product || "this application"} to latest version
                    </div>
                    <button className="text-xs font-medium text-blue-600 hover:text-blue-700">
                      View Details →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EndpointDetailCard({ endpoint }: any) {
  return (
    <div className="p-4 hover:bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <h4 className="font-medium">{endpoint.hostname}</h4>
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${
                endpoint.isCompliant
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {endpoint.isCompliant ? "Compliant" : "Non-Compliant"}
            </span>
          </div>
          <div className="mt-1 text-sm text-gray-600">
            {endpoint.operatingSystem} • Last seen:{" "}
            {endpoint.lastSeen
              ? new Date(endpoint.lastSeen).toLocaleDateString()
              : "Never"}
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right text-sm">
            <div className="font-medium">Vulnerabilities</div>
            <div className="text-gray-600">
              C:{endpoint.criticalVulns} H:{endpoint.highVulns} M:
              {endpoint.mediumVulns} L:{endpoint.lowVulns}
            </div>
          </div>
          {endpoint.windows?.needsUpdate && (
            <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
              Update Available
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-4 text-4xl">⏳</div>
        <h3 className="mb-2 text-lg font-semibold">Loading Dashboard...</h3>
        <p className="text-gray-600">
          Please wait while we gather your security data
        </p>
      </div>
    </div>
  );
}

function ErrorState({ tenantSlug, isAdmin }: any) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="max-w-md text-center">
        <div className="mb-4 text-4xl">⚠️</div>
        <h3 className="mb-2 text-lg font-semibold">Dashboard Unavailable</h3>
        <p className="mb-4 text-gray-600">
          Unable to load dashboard data for tenant: {tenantSlug}
        </p>
        {isAdmin && (
          <Link
            href="/admin/dashboard"
            className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Return to Admin Dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
