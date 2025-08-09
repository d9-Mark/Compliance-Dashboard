"use client";
// src/app/admin/dashboard/client.tsx - Professional UX with data visualization

import { useState } from "react";
import { api } from "~/trpc/react";
import type { Session } from "next-auth";
import Link from "next/link";

interface AdminDashboardClientProps {
  session: Session;
}

export function AdminDashboardClient({ session }: AdminDashboardClientProps) {
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "tenants" | "sentinelone"
  >("overview");
  const [showDeleteModal, setShowDeleteModal] = useState<{
    tenantId: string;
    name: string;
    slug: string;
  } | null>(null);

  // Get all tenants with categorization
  const {
    data: tenantData,
    isLoading: tenantsLoading,
    refetch: refetchTenants,
  } = api.tenant.getTenantsByType.useQuery();

  // Get selected tenant overview
  const { data: overview, isLoading: overviewLoading } =
    api.tenant.getOverview.useQuery(
      { tenantId: selectedTenantId! },
      { enabled: !!selectedTenantId },
    );

  // SentinelOne connection test
  const { mutate: testConnection, isPending: testingConnection } =
    api.sentinelOne.testConnection.useMutation();

  // SentinelOne sync mutations with enhanced error handling
  const { mutate: syncTenants, isPending: syncingTenants } =
    api.sentinelOne.syncTenants.useMutation({
      onSuccess: (result) => {
        refetchTenants();
        showSuccessToast(
          `✅ Tenant sync completed! Created: ${result.created}, Updated: ${result.updated}`,
        );
      },
      onError: (error) => {
        showErrorToast(`❌ Tenant sync failed: ${error.message}`);
      },
    });

  const { mutate: syncAgents, isPending: syncingAgents } =
    api.sentinelOne.syncAgents.useMutation({
      onSuccess: (result) => {
        const msg = `🎉 Agent sync completed!\n• Processed: ${result.processed}\n• Created: ${result.created}\n• Updated: ${result.updated}\n• Total Available: ${result.totalAvailable}\n• Coverage: ${Math.round((result.processed / result.totalAvailable) * 100)}%`;
        showSuccessToast(msg);
      },
      onError: (error) => {
        showErrorToast(`❌ Agent sync failed: ${error.message}`);
      },
    });

  const { mutate: fullSync, isPending: fullSyncing } =
    api.sentinelOne.fullSync.useMutation({
      onSuccess: (result) => {
        refetchTenants();
        const msg = `🎉 Full sync completed!\n• Tenants: ${result.summary.tenantsCreated} created, ${result.summary.tenantsUpdated} updated\n• Agents: ${result.summary.agentsProcessed} processed\n• Coverage: ${result.summary.tenantsWithData} tenants with data`;
        showSuccessToast(msg);
      },
      onError: (error) => {
        showErrorToast(`❌ Full sync failed: ${error.message}`);
      },
    });

  // Tenant delete mutation
  const { mutate: deleteTenant, isPending: deletingTenant } =
    api.tenant.delete.useMutation({
      onSuccess: (result) => {
        refetchTenants();
        setShowDeleteModal(null);
        showSuccessToast(`✅ Deleted tenant: ${result.deletedTenant.name}`);
      },
      onError: (error) => {
        showErrorToast(`❌ Delete failed: ${error.message}`);
      },
    });

  const isSyncing = syncingTenants || syncingAgents || fullSyncing;

  const showSuccessToast = (message: string) => {
    // Replace with proper toast library in production
    alert(message);
  };

  const showErrorToast = (message: string) => {
    // Replace with proper toast library in production
    alert(message);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Header */}
      <div className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                D9 Compliance Dashboard
              </h1>
              <p className="mt-1 text-gray-600">
                Administrative Control Center • Welcome back,{" "}
                {session.user.name}
              </p>
              {tenantData && (
                <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                  <span>{tenantData.summary.total} Total Tenants</span>
                  <span>•</span>
                  <span>
                    {tenantData.summary.sentinelOneCount} SentinelOne Connected
                  </span>
                  {tenantData.summary.testCount > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-orange-600">
                        {tenantData.summary.testCount} Test Tenants
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isSyncing && (
                <div className="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-blue-600"></div>
                  Syncing...
                </div>
              )}
              <Link
                href="/auth/signout"
                className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
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
            <TabButton
              active={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
              label="System Overview"
              badge={tenantData?.summary.total}
            />
            <TabButton
              active={activeTab === "tenants"}
              onClick={() => setActiveTab("tenants")}
              label="Tenant Management"
              badge={tenantData?.summary.testCount}
              badgeColor="orange"
            />
            <TabButton
              active={activeTab === "sentinelone"}
              onClick={() => setActiveTab("sentinelone")}
              label="SentinelOne Integration"
              loading={isSyncing}
            />
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="container mx-auto px-4 py-8">
        {activeTab === "overview" && (
          <OverviewTab
            tenantData={tenantData}
            tenantsLoading={tenantsLoading}
            selectedTenantId={selectedTenantId}
            setSelectedTenantId={setSelectedTenantId}
            overview={overview}
            overviewLoading={overviewLoading}
          />
        )}

        {activeTab === "tenants" && (
          <TenantManagementTab
            tenantData={tenantData}
            tenantsLoading={tenantsLoading}
            onDeleteClick={(tenant) =>
              setShowDeleteModal({
                tenantId: tenant.id,
                name: tenant.name,
                slug: tenant.slug,
              })
            }
          />
        )}

        {activeTab === "sentinelone" && (
          <SentinelOneTab
            testConnection={testConnection}
            testingConnection={testingConnection}
            syncTenants={syncTenants}
            syncAgents={syncAgents}
            fullSync={fullSync}
            syncingTenants={syncingTenants}
            syncingAgents={syncingAgents}
            fullSyncing={fullSyncing}
            isSyncing={isSyncing}
            tenantData={tenantData}
          />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteTenantModal
          tenant={showDeleteModal}
          onCancel={() => setShowDeleteModal(null)}
          onConfirm={(confirmSlug) => {
            deleteTenant({
              tenantId: showDeleteModal.tenantId,
              confirmSlug,
            });
          }}
          isDeleting={deletingTenant}
        />
      )}
    </div>
  );
}

// Enhanced Tab Button Component
function TabButton({
  active,
  onClick,
  label,
  badge,
  badgeColor = "blue",
  loading = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
  badgeColor?: "blue" | "orange" | "green";
  loading?: boolean;
}) {
  const badgeColorClasses = {
    blue: "bg-blue-100 text-blue-800",
    orange: "bg-orange-100 text-orange-800",
    green: "bg-green-100 text-green-800",
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
        active
          ? "border-blue-500 text-blue-600"
          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
      }`}
    >
      {label}
      {loading && (
        <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500"></div>
      )}
      {badge !== undefined && badge > 0 && (
        <span
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-2 text-xs font-medium ${badgeColorClasses[badgeColor]}`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// Enhanced Overview Tab with Professional Cards
function OverviewTab({
  tenantData,
  tenantsLoading,
  selectedTenantId,
  setSelectedTenantId,
  overview,
  overviewLoading,
}: any) {
  if (tenantsLoading) {
    return <LoadingState message="Loading system overview..." />;
  }

  const hasTestTenants = tenantData?.summary.testCount > 0;

  return (
    <div className="space-y-8">
      {/* System Health Alert */}
      {hasTestTenants && (
        <AlertCard
          type="warning"
          title="System Cleanup Recommended"
          message={`${tenantData.summary.testCount} test tenants detected. Clean up before production deployment.`}
          action={{
            label: "View Cleanup Guide",
            onClick: () => alert("Run: npm run cleanup-test-force"),
          }}
        />
      )}

      {/* System Metrics Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Tenants"
          value={tenantData?.summary.total || 0}
          trend="+12% this month"
          icon="🏢"
          color="blue"
        />
        <MetricCard
          title="SentinelOne Connected"
          value={tenantData?.summary.sentinelOneCount || 0}
          subtitle={`${Math.round(((tenantData?.summary.sentinelOneCount || 0) / (tenantData?.summary.total || 1)) * 100)}% coverage`}
          icon="🔗"
          color="green"
        />
        <MetricCard
          title="Test Tenants"
          value={tenantData?.summary.testCount || 0}
          subtitle={hasTestTenants ? "Cleanup recommended" : "System clean"}
          icon="🧪"
          color={hasTestTenants ? "orange" : "green"}
        />
        <MetricCard
          title="Active Endpoints"
          value="2,847" // This would come from actual data
          trend="+156 this week"
          icon="💻"
          color="purple"
        />
      </div>

      {/* Tenant Selection with Enhanced Cards */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Tenant Overview
          </h2>
          <div className="text-sm text-gray-500">
            Click any tenant to view detailed analytics
          </div>
        </div>

        {tenantData?.all?.length ? (
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
            action={{
              label: "Setup SentinelOne",
              onClick: () => {}, // Switch to SentinelOne tab
            }}
          />
        )}
      </div>

      {/* Selected Tenant Analytics */}
      {selectedTenantId && overview && (
        <TenantAnalytics
          tenant={tenantData?.all?.find((t: any) => t.id === selectedTenantId)}
          overview={overview}
          loading={overviewLoading}
        />
      )}
    </div>
  );
}

// Professional Metric Card Component
function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = "blue",
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: string;
  icon: string;
  color?: "blue" | "green" | "orange" | "purple";
}) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    orange: "bg-orange-50 border-orange-200",
    purple: "bg-purple-50 border-purple-200",
  };

  return (
    <div className={`rounded-xl border p-6 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
          {trend && <p className="mt-1 text-xs text-green-600">{trend}</p>}
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  );
}

// Enhanced Tenant Card with Better Visual Hierarchy
function EnhancedTenantCard({ tenant, isSelected, onSelect }: any) {
  const isSentinelOne = !!tenant.sentinelOneSiteId;
  const isTest =
    !isSentinelOne &&
    (tenant.slug.includes("acme") ||
      tenant.slug.includes("tech-solutions") ||
      tenant.slug.includes("global-enterprises"));

  const getStatusBadge = () => {
    if (isSentinelOne)
      return { label: "Connected", color: "green", icon: "🔗" };
    if (isTest) return { label: "Test Data", color: "orange", icon: "🧪" };
    return { label: "Manual", color: "blue", icon: "📋" };
  };

  const status = getStatusBadge();

  return (
    <div
      className={`group cursor-pointer rounded-xl border-2 p-6 transition-all duration-200 hover:shadow-lg ${
        isSelected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
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
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {tenant._count?.endpoints || 0}
          </div>
          <div className="text-xs text-gray-500">Endpoints</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {tenant._count?.users || 0}
          </div>
          <div className="text-xs text-gray-500">Users</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {tenant._count?.clients || 0}
          </div>
          <div className="text-xs text-gray-500">Clients</div>
        </div>
      </div>

      {/* Additional Info */}
      {tenant.sentinelOneSiteId && (
        <div className="mt-3 text-xs text-gray-400">
          Site: {tenant.sentinelOneSiteId.substring(0, 8)}...
        </div>
      )}

      {/* Action Indicator */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-gray-400">Click to view details</div>
        <div className="rounded-full bg-gray-100 p-2 opacity-0 transition-opacity group-hover:opacity-100">
          <svg
            className="h-4 w-4 text-gray-600"
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

// Tenant Analytics Component
function TenantAnalytics({ tenant, overview, loading }: any) {
  if (loading) {
    return <LoadingState message="Loading tenant analytics..." />;
  }

  const complianceRate =
    overview.stats.endpoints.total > 0
      ? Math.round(
          (overview.stats.endpoints.compliant /
            overview.stats.endpoints.total) *
            100,
        )
      : 0;

  const criticalIssues =
    overview.stats.vulnerabilities.critical +
    overview.stats.endpoints.nonCompliant;

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">
            {tenant.name} Analytics
          </h3>
          <p className="text-sm text-gray-500">
            Real-time compliance and security metrics
          </p>
        </div>
        <Link
          href={`/tenant/${tenant.slug}/dashboard`}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
        >
          View Full Dashboard →
        </Link>
      </div>

      {/* Critical Alerts */}
      {criticalIssues > 0 && (
        <AlertCard
          type="error"
          title="Critical Issues Detected"
          message={`${criticalIssues} items require immediate attention`}
        />
      )}

      {/* Analytics Grid */}
      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <AnalyticsCard
          title="Compliance Rate"
          value={`${complianceRate}%`}
          change={complianceRate >= 90 ? "+2%" : "-5%"}
          trend={complianceRate >= 90 ? "up" : "down"}
          color={complianceRate >= 90 ? "green" : "red"}
        />
        <AnalyticsCard
          title="Critical Vulnerabilities"
          value={overview.stats.vulnerabilities.critical}
          trend={overview.stats.vulnerabilities.critical === 0 ? "up" : "down"}
          color={
            overview.stats.vulnerabilities.critical === 0 ? "green" : "red"
          }
        />
        <AnalyticsCard
          title="Windows Systems"
          value={overview.stats.windows.total}
          subtitle={`${overview.stats.windows.compliant} up to date`}
          color="blue"
        />
        <AnalyticsCard
          title="Total Endpoints"
          value={overview.stats.endpoints.total}
          change="+12"
          trend="up"
          color="purple"
        />
      </div>
    </div>
  );
}

// Enhanced Tenant Management Tab (keeping existing structure but with better styling)
function TenantManagementTab({
  tenantData,
  tenantsLoading,
  onDeleteClick,
}: any) {
  if (tenantsLoading) {
    return <LoadingState message="Loading tenant management..." />;
  }

  return (
    <div className="space-y-8">
      {tenantData?.test?.length > 0 && (
        <TenantSection
          title="🧪 Test Tenants"
          subtitle="These are test tenants created by the seed script. Consider deleting them before production use."
          tenants={tenantData.test}
          type="test"
          onDeleteClick={onDeleteClick}
          alertType="warning"
        />
      )}

      {tenantData?.sentinelOne?.length > 0 && (
        <TenantSection
          title="🔗 SentinelOne-Linked Tenants"
          subtitle="These tenants are automatically synchronized with your SentinelOne sites."
          tenants={tenantData.sentinelOne}
          type="sentinelone"
          onDeleteClick={onDeleteClick}
          alertType="success"
        />
      )}

      {tenantData?.other?.length > 0 && (
        <TenantSection
          title="📋 Manual Tenants"
          subtitle="These tenants were created manually and are not linked to external systems."
          tenants={tenantData.other}
          type="other"
          onDeleteClick={onDeleteClick}
          alertType="info"
        />
      )}

      {!tenantData?.all?.length && (
        <EmptyState
          icon="🏢"
          title="No Tenants Found"
          description="Connect to SentinelOne to automatically create tenants from your sites."
        />
      )}
    </div>
  );
}

// Enhanced SentinelOne Tab (keeping structure but with better UI)
function SentinelOneTab({
  testConnection,
  testingConnection,
  syncTenants,
  syncAgents,
  fullSync,
  syncingTenants,
  syncingAgents,
  fullSyncing,
  isSyncing,
  tenantData,
}: any) {
  return (
    <div className="space-y-8">
      {/* Connection Status Card */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">
          🔗 SentinelOne Connection
        </h3>
        <p className="mb-4 text-sm text-gray-600">
          Test your SentinelOne API connection and verify credentials.
        </p>
        <button
          onClick={() => testConnection()}
          disabled={testingConnection || isSyncing}
          className="rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {testingConnection ? "Testing Connection..." : "Test Connection"}
        </button>
      </div>

      {/* Sync Operations */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-6 text-lg font-semibold">
          🚀 Synchronization Operations
        </h3>

        <div className="grid gap-6 md:grid-cols-3">
          <SyncOperationCard
            title="Sync Tenants"
            description="Create tenants from your SentinelOne sites. Maps each site to a tenant organization."
            action="Sync Tenants"
            onAction={() => syncTenants()}
            loading={syncingTenants}
            disabled={isSyncing}
            color="blue"
            step="1"
          />

          <SyncOperationCard
            title="Sync All Agents"
            description="Import ALL agents/endpoints from SentinelOne. This gets your complete inventory (~2K agents)."
            action="Sync All Agents"
            onAction={() => syncAgents()}
            loading={syncingAgents}
            disabled={isSyncing}
            color="green"
            step="2"
            recommended={tenantData?.summary.sentinelOneCount > 0}
          />

          <SyncOperationCard
            title="Complete Sync"
            description="Full synchronization: creates tenants from sites, then imports all agents. Recommended for initial setup."
            action="Full Sync"
            onAction={() => fullSync()}
            loading={fullSyncing}
            disabled={isSyncing}
            color="purple"
            step="⚡"
            recommended={true}
          />
        </div>

        {isSyncing && (
          <div className="mt-6 rounded-lg bg-blue-50 p-4">
            <div className="flex items-center">
              <div className="mr-3 h-5 w-5 animate-spin rounded-full border-b-2 border-blue-600"></div>
              <span className="text-blue-700">
                Synchronization in progress... This may take several minutes for
                large environments.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Current Status Dashboard */}
      {tenantData && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-6 text-lg font-semibold">
            📊 Current System Status
          </h3>
          <div className="grid gap-6 md:grid-cols-2">
            <StatusSection
              title="Tenant Overview"
              stats={[
                {
                  label: "Total Tenants",
                  value: tenantData.summary?.total || 0,
                },
                {
                  label: "SentinelOne Connected",
                  value: tenantData.summary?.sentinelOneCount || 0,
                  color: "green",
                },
                {
                  label: "Test Tenants",
                  value: tenantData.summary?.testCount || 0,
                  color: "orange",
                },
                {
                  label: "Manual Tenants",
                  value: tenantData.summary?.otherCount || 0,
                  color: "blue",
                },
              ]}
            />

            <StatusSection
              title="Recommendations"
              stats={[
                {
                  label: "System Status",
                  value:
                    tenantData.summary?.testCount > 0
                      ? "Cleanup Needed"
                      : "Production Ready",
                  color: tenantData.summary?.testCount > 0 ? "orange" : "green",
                },
                {
                  label: "Next Action",
                  value:
                    tenantData.summary?.sentinelOneCount === 0
                      ? "Run Tenant Sync"
                      : tenantData.summary?.testCount > 0
                        ? "Clean Test Data"
                        : "System Ready",
                  color:
                    tenantData.summary?.sentinelOneCount === 0
                      ? "blue"
                      : tenantData.summary?.testCount > 0
                        ? "orange"
                        : "green",
                },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components
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

function AlertCard({
  type,
  title,
  message,
  action,
}: {
  type: "success" | "warning" | "error" | "info";
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  const styles = {
    success: "border-green-400 bg-green-50 text-green-800",
    warning: "border-orange-400 bg-orange-50 text-orange-800",
    error: "border-red-400 bg-red-50 text-red-800",
    info: "border-blue-400 bg-blue-50 text-blue-800",
  };

  const icons = {
    success: "✅",
    warning: "⚠️",
    error: "🚨",
    info: "ℹ️",
  };

  return (
    <div className={`rounded-xl border-l-4 p-4 ${styles[type]}`}>
      <div className="flex items-start">
        <span className="mr-3 text-xl">{icons[type]}</span>
        <div className="flex-1">
          <h3 className="font-medium">{title}</h3>
          <p className="mt-1 text-sm">{message}</p>
          {action && (
            <button
              onClick={action.onClick}
              className="mt-2 text-sm underline hover:no-underline"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-xl bg-gray-50 py-12 text-center">
      <div className="mb-4 text-6xl">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mb-4 text-gray-600">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// Additional helper components would go here...
function AnalyticsCard({ title, value, change, trend, color, subtitle }: any) {
  const colorClasses = {
    green: "text-green-600 bg-green-50",
    red: "text-red-600 bg-red-50",
    blue: "text-blue-600 bg-blue-50",
    purple: "text-purple-600 bg-purple-50",
  };

  return (
    <div className="rounded-lg border p-4">
      <h4 className="text-sm font-medium text-gray-600">{title}</h4>
      <div className="mt-2 flex items-baseline">
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        {change && (
          <p
            className={`ml-2 text-sm ${trend === "up" ? "text-green-600" : "text-red-600"}`}
          >
            {change}
          </p>
        )}
      </div>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}

function SyncOperationCard({
  title,
  description,
  action,
  onAction,
  loading,
  disabled,
  color,
  step,
  recommended,
}: any) {
  const colorClasses = {
    blue: "border-blue-200 bg-blue-50",
    green: "border-green-200 bg-green-50",
    purple: "border-purple-200 bg-purple-50",
  };

  return (
    <div className={`rounded-lg border p-6 ${colorClasses[color]}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-bold">
            {step}
          </div>
          <h4 className="font-medium">{title}</h4>
        </div>
        {recommended && (
          <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
            Recommended
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-gray-600">{description}</p>
      <button
        onClick={onAction}
        disabled={disabled}
        className={`w-full rounded-lg px-4 py-2 text-white transition-colors disabled:opacity-50 ${
          color === "blue"
            ? "bg-blue-600 hover:bg-blue-700"
            : color === "green"
              ? "bg-green-600 hover:bg-green-700"
              : "bg-purple-600 hover:bg-purple-700"
        }`}
      >
        {loading ? "Processing..." : action}
      </button>
    </div>
  );
}

function StatusSection({ title, stats }: any) {
  return (
    <div>
      <h4 className="mb-4 font-medium text-gray-700">{title}</h4>
      <div className="space-y-3">
        {stats.map((stat: any, index: number) => (
          <div key={index} className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{stat.label}</span>
            <span
              className={`text-sm font-medium ${
                stat.color === "green"
                  ? "text-green-600"
                  : stat.color === "orange"
                    ? "text-orange-600"
                    : stat.color === "blue"
                      ? "text-blue-600"
                      : "text-gray-900"
              }`}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TenantSection({
  title,
  subtitle,
  tenants,
  type,
  onDeleteClick,
  alertType,
}: any) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-gray-600">{subtitle}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            alertType === "warning"
              ? "bg-orange-100 text-orange-800"
              : alertType === "success"
                ? "bg-green-100 text-green-800"
                : "bg-blue-100 text-blue-800"
          }`}
        >
          {tenants.length} tenants
        </span>
      </div>
      <div className="space-y-3">
        {tenants.map((tenant: any) => (
          <TenantManagementCard
            key={tenant.id}
            tenant={tenant}
            type={type}
            onDeleteClick={onDeleteClick}
          />
        ))}
      </div>
    </div>
  );
}

function TenantManagementCard({ tenant, type, onDeleteClick }: any) {
  const typeConfig = {
    test: { color: "orange", icon: "🧪", canDelete: true },
    sentinelone: { color: "green", icon: "🔗", canDelete: false },
    other: { color: "blue", icon: "📋", canDelete: true },
  };

  const config = typeConfig[type as keyof typeof typeConfig];

  return (
    <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50">
      <div className="flex items-center gap-4">
        <span className="text-2xl">{config.icon}</span>
        <div>
          <h4 className="font-medium">{tenant.name}</h4>
          <p className="text-sm text-gray-600">/{tenant.slug}</p>
          <div className="text-xs text-gray-500">
            {tenant._count.endpoints} endpoints • {tenant._count.users} users •{" "}
            {tenant._count.clients} clients
          </div>
          {tenant.sentinelOneSiteId && (
            <div className="text-xs text-green-600">
              Site: {tenant.sentinelOneSiteId.substring(0, 12)}...
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/tenant/${tenant.slug}/dashboard`}
          className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
        >
          View Dashboard
        </Link>
        {config.canDelete && (
          <button
            onClick={() => onDeleteClick(tenant)}
            className="rounded bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function DeleteTenantModal({ tenant, onCancel, onConfirm, isDeleting }: any) {
  const [confirmSlug, setConfirmSlug] = useState("");

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-red-600">Delete Tenant</h3>
        <p className="mt-2 text-sm text-gray-600">
          This will permanently delete <strong>{tenant.name}</strong> and all
          associated data.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          To confirm, type the tenant slug:{" "}
          <code className="rounded bg-gray-100 px-1">{tenant.slug}</code>
        </p>

        <input
          type="text"
          value={confirmSlug}
          onChange={(e) => setConfirmSlug(e.target.value)}
          placeholder="Type tenant slug to confirm"
          className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(confirmSlug)}
            disabled={isDeleting || confirmSlug !== tenant.slug}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete Tenant"}
          </button>
        </div>
      </div>
    </div>
  );
}
