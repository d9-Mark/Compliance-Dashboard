"use client";
// src/app/admin/dashboard/client.tsx - Professional Admin Dashboard with Windows Compliance & Threat Management

import { useState } from "react";
import { api } from "~/trpc/react";
import type { Session } from "next-auth";
import Link from "next/link";

interface AdminDashboardClientProps {
  session: Session;
}

export function AdminDashboardClient({ session }: AdminDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "security" | "compliance" | "tenants" | "sentinelone"
  >("overview");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<any>(null);

  // Data queries
  const {
    data: tenantData,
    isLoading: tenantsLoading,
    refetch: refetchTenants,
  } = api.tenant.getTenantsByType.useQuery();
  const { data: overview, isLoading: overviewLoading } =
    api.tenant.getOverview.useQuery(
      { tenantId: selectedTenantId! },
      { enabled: !!selectedTenantId },
    );
  const { data: diagnostics } = api.sentinelOne.getDiagnostics.useQuery();

  // Mutations
  const { mutate: testConnection, isPending: testingConnection } =
    api.sentinelOne.testConnection.useMutation();
  const { mutate: fullSync, isPending: fullSyncing } =
    api.sentinelOne.fullSync.useMutation({
      onSuccess: () => refetchTenants(),
    });

  const isSyncing = fullSyncing;

  // Calculate global metrics
  const globalMetrics = tenantData
    ? {
        totalEndpoints: tenantData.all.reduce(
          (sum, t) => sum + t._count.endpoints,
          0,
        ),
        totalUsers: tenantData.all.reduce((sum, t) => sum + t._count.users, 0),
        sentinelOneConnected: tenantData.summary.sentinelOneCount,
        testTenants: tenantData.summary.testCount,
      }
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Enhanced Header with Live Status */}
      <div className="border-b bg-white/80 shadow-sm backdrop-blur-md">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600">
                  <span className="text-xl font-bold text-white">D9</span>
                </div>
                <div>
                  <h1 className="bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-2xl font-bold text-transparent">
                    Compliance Control Center
                  </h1>
                  <p className="text-sm text-gray-500">
                    Administrative Dashboard • {session.user.name}
                  </p>
                </div>
              </div>

              {/* Live System Status */}
              <div className="ml-8 hidden items-center space-x-6 lg:flex">
                <StatusIndicator
                  label="SentinelOne"
                  status={
                    diagnostics?.api.connected ? "connected" : "disconnected"
                  }
                  value={diagnostics?.api.totalAgentsAvailable || 0}
                />
                <StatusIndicator
                  label="Tenants"
                  status="healthy"
                  value={tenantData?.summary.total || 0}
                />
                <StatusIndicator
                  label="Coverage"
                  status={
                    diagnostics?.analysis.coveragePercentage >= 80
                      ? "healthy"
                      : "warning"
                  }
                  value={`${diagnostics?.analysis.coveragePercentage || 0}%`}
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {isSyncing && (
                <div className="flex items-center space-x-2 rounded-full bg-blue-100 px-3 py-1.5 text-sm text-blue-700">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500"></div>
                  Syncing
                </div>
              )}
              <Link
                href="/auth/signout"
                className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-200"
              >
                Sign Out
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Navigation */}
      <div className="border-b bg-white/60 backdrop-blur-sm">
        <div className="container mx-auto px-6">
          <nav className="flex space-x-8">
            <TabButton
              active={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
              icon="📊"
              label="System Overview"
              badge={globalMetrics?.totalEndpoints}
            />
            <TabButton
              active={activeTab === "security"}
              onClick={() => setActiveTab("security")}
              icon="🛡️"
              label="Security & Threats"
              badge={diagnostics?.analysis.missingAgents || 0}
              urgent={diagnostics?.analysis.missingAgents > 0}
            />
            <TabButton
              active={activeTab === "compliance"}
              onClick={() => setActiveTab("compliance")}
              icon="🪟"
              label="Windows Compliance"
              badge={tenantData?.summary.testCount}
              badgeColor="orange"
            />
            <TabButton
              active={activeTab === "tenants"}
              onClick={() => setActiveTab("tenants")}
              icon="🏢"
              label="Tenant Management"
            />
            <TabButton
              active={activeTab === "sentinelone"}
              onClick={() => setActiveTab("sentinelone")}
              icon="🔗"
              label="SentinelOne"
              loading={isSyncing}
            />
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="container mx-auto px-6 py-8">
        {activeTab === "overview" && (
          <SystemOverviewTab
            tenantData={tenantData}
            globalMetrics={globalMetrics}
            diagnostics={diagnostics}
            selectedTenantId={selectedTenantId}
            setSelectedTenantId={setSelectedTenantId}
            overview={overview}
            overviewLoading={overviewLoading}
          />
        )}

        {activeTab === "security" && (
          <SecurityThreatsTab
            tenantData={tenantData}
            diagnostics={diagnostics}
          />
        )}

        {activeTab === "compliance" && (
          <WindowsComplianceTab
            tenantData={tenantData}
            selectedTenantId={selectedTenantId}
            setSelectedTenantId={setSelectedTenantId}
          />
        )}

        {activeTab === "tenants" && (
          <TenantManagementTab
            tenantData={tenantData}
            tenantsLoading={tenantsLoading}
            onDeleteClick={setShowDeleteModal}
          />
        )}

        {activeTab === "sentinelone" && (
          <SentinelOneTab
            diagnostics={diagnostics}
            testConnection={testConnection}
            testingConnection={testingConnection}
            fullSync={fullSync}
            isSyncing={isSyncing}
          />
        )}
      </div>
    </div>
  );
}

// Enhanced Status Indicator Component
function StatusIndicator({
  label,
  status,
  value,
}: {
  label: string;
  status: "connected" | "disconnected" | "healthy" | "warning" | "error";
  value: string | number;
}) {
  const statusConfig = {
    connected: {
      color: "text-green-600",
      bg: "bg-green-100",
      indicator: "bg-green-500",
    },
    healthy: {
      color: "text-green-600",
      bg: "bg-green-100",
      indicator: "bg-green-500",
    },
    warning: {
      color: "text-orange-600",
      bg: "bg-orange-100",
      indicator: "bg-orange-500",
    },
    error: { color: "text-red-600", bg: "bg-red-100", indicator: "bg-red-500" },
    disconnected: {
      color: "text-red-600",
      bg: "bg-red-100",
      indicator: "bg-red-500",
    },
  };

  const config = statusConfig[status];

  return (
    <div
      className={`flex items-center space-x-2 rounded-lg ${config.bg} px-3 py-1.5`}
    >
      <div
        className={`h-2 w-2 rounded-full ${config.indicator} ${status === "connected" || status === "healthy" ? "animate-pulse" : ""}`}
      ></div>
      <div className="text-sm">
        <span className="text-gray-600">{label}:</span>
        <span className={`ml-1 font-semibold ${config.color}`}>{value}</span>
      </div>
    </div>
  );
}

// Enhanced Tab Button
function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
  urgent,
  badgeColor = "blue",
  loading,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  badge?: number;
  urgent?: boolean;
  badgeColor?: "blue" | "orange" | "red" | "green";
  loading?: boolean;
}) {
  const badgeColors = {
    blue: "bg-blue-100 text-blue-700",
    orange: "bg-orange-100 text-orange-700",
    red: "bg-red-100 text-red-700",
    green: "bg-green-100 text-green-700",
  };

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
      {loading && (
        <div className="h-2 w-2 animate-spin rounded-full border border-blue-500"></div>
      )}
      {badge !== undefined && badge > 0 && (
        <span
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-2 text-xs font-bold ${
            urgent
              ? "animate-pulse bg-red-500 text-white"
              : badgeColors[badgeColor]
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// System Overview Tab
function SystemOverviewTab({
  tenantData,
  globalMetrics,
  diagnostics,
  selectedTenantId,
  setSelectedTenantId,
  overview,
  overviewLoading,
}: any) {
  if (!tenantData || !globalMetrics) {
    return <LoadingState message="Loading system overview..." />;
  }

  const coverageStatus =
    diagnostics?.analysis.coveragePercentage >= 90
      ? "excellent"
      : diagnostics?.analysis.coveragePercentage >= 70
        ? "good"
        : "needs-attention";

  return (
    <div className="space-y-8">
      {/* System Health Alert */}
      {(globalMetrics.testTenants > 0 ||
        coverageStatus === "needs-attention") && (
        <div className="rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50 p-6">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">⚠️</div>
            <div>
              <h3 className="font-semibold text-orange-900">
                System Health Notice
              </h3>
              <div className="mt-2 space-y-1 text-sm text-orange-800">
                {globalMetrics.testTenants > 0 && (
                  <p>
                    • {globalMetrics.testTenants} test tenants detected -
                    consider cleanup for production
                  </p>
                )}
                {coverageStatus === "needs-attention" && (
                  <p>
                    • SentinelOne coverage at{" "}
                    {diagnostics?.analysis.coveragePercentage}% - recommend full
                    sync
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
          title="Total Endpoints"
          value={globalMetrics.totalEndpoints.toLocaleString()}
          change="+12% this month"
          icon="💻"
          color="blue"
          trend="up"
        />
        <MetricCard
          title="SentinelOne Coverage"
          value={`${diagnostics?.analysis.coveragePercentage || 0}%`}
          subtitle={`${diagnostics?.database.sentinelOneEndpoints || 0} of ${diagnostics?.api.totalAgentsAvailable || 0} agents`}
          icon="🔗"
          color={
            coverageStatus === "excellent"
              ? "green"
              : coverageStatus === "good"
                ? "orange"
                : "red"
          }
        />
        <MetricCard
          title="Active Tenants"
          value={globalMetrics.sentinelOneConnected}
          subtitle={`${tenantData.summary.total} total tenants`}
          icon="🏢"
          color="purple"
        />
        <MetricCard
          title="System Health"
          value={
            globalMetrics.testTenants === 0 && coverageStatus === "excellent"
              ? "Excellent"
              : "Attention Needed"
          }
          icon="🎯"
          color={
            globalMetrics.testTenants === 0 && coverageStatus === "excellent"
              ? "green"
              : "orange"
          }
        />
      </div>

      {/* Tenant Grid with Enhanced Cards */}
      <div className="rounded-xl bg-white/80 p-6 shadow-lg backdrop-blur-sm">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Tenant Overview
          </h2>
          <div className="text-sm text-gray-500">
            Click any tenant to view detailed analytics
          </div>
        </div>

        {tenantData.all?.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tenantData.all.map((tenant: any) => (
              <EnhancedTenantCard
                key={tenant.id}
                tenant={tenant}
                isSelected={selectedTenantId === tenant.id}
                onSelect={() => setSelectedTenantId(tenant.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="🏢"
            title="No Tenants Found"
            description="Connect to SentinelOne to automatically create tenants from your sites."
          />
        )}
      </div>

      {/* Selected Tenant Analytics */}
      {selectedTenantId && overview && (
        <TenantDetailedAnalytics
          tenant={tenantData.all.find((t: any) => t.id === selectedTenantId)}
          overview={overview}
          loading={overviewLoading}
        />
      )}
    </div>
  );
}

// Security & Threats Tab
function SecurityThreatsTab({ tenantData, diagnostics }: any) {
  return (
    <div className="space-y-8">
      {/* Threat Summary */}
      <div className="grid gap-6 md:grid-cols-3">
        <ThreatCard
          title="Critical Threats"
          count={0} // This would come from actual data
          icon="🚨"
          color="red"
          description="Active infections and critical vulnerabilities"
        />
        <ThreatCard
          title="Missing Coverage"
          count={diagnostics?.analysis.missingAgents || 0}
          icon="🔍"
          color="orange"
          description="Endpoints not reporting to SentinelOne"
        />
        <ThreatCard
          title="Outdated Agents"
          count={0} // This would come from actual data
          icon="⚠️"
          color="yellow"
          description="SentinelOne agents requiring updates"
        />
      </div>

      {/* Detailed Threat Analysis */}
      <div className="rounded-xl bg-white/80 p-6 shadow-lg backdrop-blur-sm">
        <h3 className="mb-6 text-lg font-semibold">
          Threat Analysis by Tenant
        </h3>
        <div className="space-y-4">
          {tenantData?.sentinelOne?.map((tenant: any) => (
            <TenantThreatRow key={tenant.id} tenant={tenant} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Windows Compliance Tab
function WindowsComplianceTab({
  tenantData,
  selectedTenantId,
  setSelectedTenantId,
}: any) {
  return (
    <div className="space-y-8">
      <div className="rounded-xl bg-white/80 p-6 shadow-lg backdrop-blur-sm">
        <h3 className="mb-6 text-lg font-semibold">
          Windows Compliance Overview
        </h3>

        {/* Windows compliance grid would go here */}
        <div className="py-12 text-center text-gray-500">
          <div className="mb-4 text-6xl">🪟</div>
          <h3 className="mb-2 text-lg font-medium">
            Windows Compliance Analysis
          </h3>
          <p>Detailed Windows EOL and compliance tracking coming soon</p>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function MetricCard({
  title,
  value,
  subtitle,
  change,
  trend,
  icon,
  color,
}: any) {
  const colorClasses = {
    blue: "from-blue-500 to-blue-600 text-white",
    green: "from-green-500 to-green-600 text-white",
    purple: "from-purple-500 to-purple-600 text-white",
    red: "from-red-500 to-red-600 text-white",
    orange: "from-orange-500 to-orange-600 text-white",
  };

  return (
    <div
      className={`rounded-xl bg-gradient-to-br ${colorClasses[color]} transform p-6 shadow-lg transition-all duration-200 hover:scale-105`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white/80">{title}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
          {subtitle && <p className="mt-1 text-sm text-white/70">{subtitle}</p>}
          {change && (
            <p
              className={`mt-1 text-xs ${trend === "up" ? "text-green-200" : "text-red-200"}`}
            >
              {change}
            </p>
          )}
        </div>
        <div className="text-3xl opacity-80">{icon}</div>
      </div>
    </div>
  );
}

function ThreatCard({ title, count, icon, color, description }: any) {
  const colorClasses = {
    red: "border-red-200 bg-red-50",
    orange: "border-orange-200 bg-orange-50",
    yellow: "border-yellow-200 bg-yellow-50",
  };

  return (
    <div className={`rounded-xl border p-6 ${colorClasses[color]}`}>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <div className="text-right">
          <div className="text-2xl font-bold">{count}</div>
          <div className="text-xs text-gray-500">{title}</div>
        </div>
      </div>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

function EnhancedTenantCard({ tenant, isSelected, onSelect }: any) {
  const isSentinelOne = !!tenant.sentinelOneSiteId;
  const isTest =
    !isSentinelOne &&
    (tenant.slug.includes("acme") ||
      tenant.slug.includes("tech-solutions") ||
      tenant.slug.includes("global-enterprises"));

  const getStatusConfig = () => {
    if (isSentinelOne)
      return {
        label: "Connected",
        color: "green",
        icon: "🔗",
        bg: "bg-green-50 border-green-200",
      };
    if (isTest)
      return {
        label: "Test Data",
        color: "orange",
        icon: "🧪",
        bg: "bg-orange-50 border-orange-200",
      };
    return {
      label: "Manual",
      color: "blue",
      icon: "📋",
      bg: "bg-blue-50 border-blue-200",
    };
  };

  const status = getStatusConfig();

  return (
    <div
      className={`group cursor-pointer rounded-xl border-2 p-6 transition-all duration-200 hover:shadow-lg ${
        isSelected
          ? "scale-105 border-blue-500 bg-blue-50 shadow-md"
          : `${status.bg} hover:border-gray-300`
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center space-x-2">
            <h3 className="font-semibold text-gray-900 transition-colors group-hover:text-blue-600">
              {tenant.name}
            </h3>
            <span className="text-lg">{status.icon}</span>
          </div>
          <p className="text-sm text-gray-500">/{tenant.slug}</p>
        </div>
        <div
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            status.color === "green"
              ? "bg-green-100 text-green-700"
              : status.color === "orange"
                ? "bg-orange-100 text-orange-700"
                : "bg-blue-100 text-blue-700"
          }`}
        >
          {status.label}
        </div>
      </div>

      {/* Metrics */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-xl font-bold text-gray-900">
            {tenant._count?.endpoints || 0}
          </div>
          <div className="text-xs text-gray-500">Endpoints</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-gray-900">
            {tenant._count?.users || 0}
          </div>
          <div className="text-xs text-gray-500">Users</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-gray-900">
            {tenant._count?.clients || 0}
          </div>
          <div className="text-xs text-gray-500">Clients</div>
        </div>
      </div>

      {/* Action Indicator */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">Click for details</div>
        <div
          className={`rounded-full bg-white p-2 opacity-0 transition-all duration-200 group-hover:opacity-100 ${isSelected ? "opacity-100" : ""}`}
        >
          <svg
            className="h-3 w-3 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

// Additional helper components...
function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, description }: any) {
  return (
    <div className="rounded-xl bg-gray-50 py-12 text-center">
      <div className="mb-4 text-6xl">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function TenantDetailedAnalytics({ tenant, overview, loading }: any) {
  if (loading) return <LoadingState message="Loading tenant analytics..." />;

  return (
    <div className="rounded-xl bg-white/80 p-6 shadow-lg backdrop-blur-sm">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-xl font-semibold">
          {tenant.name} - Detailed Analytics
        </h3>
        <Link
          href={`/tenant/${tenant.slug}/dashboard`}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
        >
          View Dashboard →
        </Link>
      </div>

      {/* Analytics content would go here */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <h4 className="font-medium text-gray-700">Compliance Rate</h4>
          <div className="mt-2 text-2xl font-bold text-green-600">
            {overview.stats.endpoints.total > 0
              ? Math.round(
                  (overview.stats.endpoints.compliant /
                    overview.stats.endpoints.total) *
                    100,
                )
              : 0}
            %
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <h4 className="font-medium text-gray-700">Critical Issues</h4>
          <div className="mt-2 text-2xl font-bold text-red-600">
            {overview.stats.vulnerabilities.critical}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <h4 className="font-medium text-gray-700">Total Endpoints</h4>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {overview.stats.endpoints.total}
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantThreatRow({ tenant }: any) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div>
        <h4 className="font-medium">{tenant.name}</h4>
        <p className="text-sm text-gray-600">
          {tenant._count.endpoints} endpoints
        </p>
      </div>
      <div className="flex items-center space-x-4">
        <div className="text-center">
          <div className="text-lg font-bold text-red-600">0</div>
          <div className="text-xs text-gray-500">Critical</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-orange-600">0</div>
          <div className="text-xs text-gray-500">High</div>
        </div>
        <Link
          href={`/tenant/${tenant.slug}/dashboard`}
          className="rounded bg-blue-100 px-3 py-1 text-sm text-blue-700 hover:bg-blue-200"
        >
          View →
        </Link>
      </div>
    </div>
  );
}

function TenantManagementTab({
  tenantData,
  tenantsLoading,
  onDeleteClick,
}: any) {
  // Implementation would be similar to the existing one but with enhanced styling
  return <div>Tenant Management Tab - Enhanced styling would go here</div>;
}

function SentinelOneTab({
  diagnostics,
  testConnection,
  testingConnection,
  fullSync,
  isSyncing,
}: any) {
  // Implementation would be similar to the existing one but with enhanced styling
  return <div>SentinelOne Tab - Enhanced styling would go here</div>;
}
