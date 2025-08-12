// src/app/admin/dashboard/client.tsx - Restored with CVE addition
"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import type { Session } from "next-auth";
import Link from "next/link";

interface AdminDashboardClientProps {
  session: Session;
}

export function AdminDashboardClient({ session }: AdminDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "security"
    | "compliance"
    | "tenants"
    | "sentinelone"
    | "vulnerabilities"
  >("overview");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<any>(null);

  // Existing data queries that work
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

  // CVE-related queries (safe with error handling)
  const {
    data: cveStats,
    refetch: refetchCveStats,
    error: cveStatsError,
    isLoading: cveStatsLoading,
  } = api.cveManagement?.getSyncStatistics?.useQuery(undefined, {
    enabled: !!api.cveManagement?.getSyncStatistics,
    retry: false,
  }) || { data: null, refetch: () => {}, error: null, isLoading: false };

  const { data: cveSyncHistory, error: cveSyncHistoryError } =
    api.cveManagement?.getSyncHistory?.useQuery(
      { limit: 5 },
      {
        enabled: !!api.cveManagement?.getSyncHistory,
        retry: false,
      },
    ) || { data: null, error: null };

  // Existing mutations
  const { mutate: testConnection, isPending: testingConnection } =
    api.sentinelOne.testConnection.useMutation();

  const { mutate: fullSync, isPending: fullSyncing } =
    api.sentinelOne.fullSync.useMutation({
      onSuccess: () => refetchTenants(),
    });

  // CVE mutations (safe)
  const { mutate: syncCVEs, isPending: cveSyncing } =
    api.cveManagement?.syncAllCVEs?.useMutation({
      onSuccess: () => {
        refetchCveStats();
        refetchTenants();
      },
      onError: (error) => {
        console.error("CVE sync failed:", error);
      },
    }) || { mutate: () => {}, isPending: false };

  const isSyncing = fullSyncing || cveSyncing;

  // FIXED: Calculate global metrics using the correct data structure
  const globalMetrics = tenantData?.all
    ? (() => {
        const allTenants = tenantData.all; // This is the actual array
        return {
          totalTenants: allTenants.length,
          totalEndpoints: allTenants.reduce(
            (sum, t) => sum + (t.endpoints?.length || 0),
            0,
          ),
          averageCompliance:
            allTenants.length > 0
              ? Math.round(
                  allTenants.reduce((sum, t) => {
                    const endpoints = t.endpoints || [];
                    const tenantAvg =
                      endpoints.length > 0
                        ? endpoints.reduce(
                            (eSum, e) => eSum + (e.complianceScore || 0),
                            0,
                          ) / endpoints.length
                        : 0;
                    return sum + tenantAvg;
                  }, 0) / allTenants.length,
                )
              : 0,
          totalThreats: allTenants.reduce(
            (sum, t) =>
              sum +
              (t.endpoints || []).reduce(
                (eSum, e) => eSum + (e.activeThreats || 0),
                0,
              ),
            0,
          ),
          totalVulnerabilities: cveStats?.totalEndpointVulnerabilities || 0,
          criticalVulns: cveStats?.vulnerabilitiesBySeverity?.CRITICAL || 0,
        };
      })()
    : null;

  const cveAvailable = !!api.cveManagement?.getSyncStatistics;

  // RESTORED: Original Overview component
  const renderOverview = () => {
    if (!selectedTenantId) {
      return (
        <div className="space-y-6">
          {/* CVE Status Alert */}
          {cveAvailable && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-blue-400">🛡️</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    CVE Integration Active
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      CVE management is ready.{" "}
                      {cveStats
                        ? `${cveStats.totalVulnerabilities} vulnerabilities tracked.`
                        : "Run initial sync to import CVE data."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Debug Info (remove this after fixing) */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="text-sm">
              <div>🔍 Debug Info:</div>
              <div>Tenant Data Type: {typeof tenantData}</div>
              <div>Has .all property: {tenantData?.all ? "Yes" : "No"}</div>
              <div>All Tenants Count: {tenantData?.all?.length || 0}</div>
              <div>
                SentinelOne Tenants: {tenantData?.sentinelOne?.length || 0}
              </div>
              <div>Test Tenants: {tenantData?.test?.length || 0}</div>
              <div>CVE Available: {cveAvailable ? "Yes" : "No"}</div>
            </div>
          </div>

          <div className="rounded-lg border p-6">
            <h3 className="mb-6 text-lg font-semibold">
              Select a tenant to view overview
            </h3>
            <div className="grid gap-4">
              {tenantData?.all?.length > 0 ? (
                tenantData.all.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => setSelectedTenantId(tenant.id)}
                    className="flex items-center justify-between rounded-lg border p-4 text-left hover:bg-gray-50"
                  >
                    <div>
                      <h4 className="font-medium">{tenant.name}</h4>
                      <p className="text-sm text-gray-600">
                        {tenant.endpoints?.length || 0} endpoints
                      </p>
                    </div>
                    <div className="text-sm text-blue-600">View →</div>
                  </button>
                ))
              ) : (
                <div className="py-8 text-center text-gray-500">
                  <div className="mb-2 text-4xl">🏢</div>
                  <p>
                    No tenants found. Set up SentinelOne integration to sync
                    tenants.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (overviewLoading) {
      return <div className="text-center">Loading overview...</div>;
    }

    if (!overview) {
      return (
        <div className="text-center text-red-600">Failed to load overview</div>
      );
    }

    // RESTORED: Original overview with added CVE data
    return (
      <div className="space-y-6">
        <OverviewStatsGrid overview={overview} cveStats={cveStats} />
        <TenantThreatsList tenantData={tenantData?.all || []} />
      </div>
    );
  };

  // NEW: CVE Management Tab
  const renderVulnerabilities = () => {
    if (!cveAvailable) {
      return (
        <div className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-medium text-gray-900">
              CVE Management Setup Required
            </h3>
          </div>
          <div className="p-6">
            <div className="text-center">
              <div className="mb-4 text-6xl">🚧</div>
              <h3 className="mb-2 text-lg font-medium text-gray-900">
                CVE Integration Not Configured
              </h3>
              <p className="mb-6 text-gray-600">
                Complete the CVE router setup to enable vulnerability
                management.
              </p>
              <div className="mx-auto max-w-md space-y-2 text-left">
                <p className="text-sm font-medium text-gray-900">
                  Setup Steps:
                </p>
                <ol className="list-inside list-decimal space-y-1 text-sm text-gray-600">
                  <li>Add CVE management router to your tRPC setup</li>
                  <li>Create the CVE service files</li>
                  <li>
                    Run{" "}
                    <code className="rounded bg-gray-100 px-1">
                      npx prisma generate
                    </code>
                  </li>
                  <li>Restart your development server</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* CVE Management Header */}
        <div className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                CVE Management
              </h3>
              <button
                onClick={() => syncCVEs()}
                disabled={cveSyncing}
                className={`inline-flex items-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm ${
                  cveSyncing
                    ? "cursor-not-allowed bg-gray-400"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {cveSyncing ? "🔄 Syncing CVEs..." : "🔄 Sync All CVEs"}
              </button>
            </div>
          </div>

          <div className="p-6">
            {cveStatsLoading ? (
              <div className="py-8 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading CVE statistics...</p>
              </div>
            ) : cveStats ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Statistics */}
                <div>
                  <h4 className="text-md mb-4 font-medium text-gray-900">
                    Current Statistics
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-red-50 p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {cveStats.vulnerabilitiesBySeverity?.CRITICAL || 0}
                      </div>
                      <div className="text-sm text-red-700">Critical</div>
                    </div>
                    <div className="rounded-lg bg-orange-50 p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {cveStats.vulnerabilitiesBySeverity?.HIGH || 0}
                      </div>
                      <div className="text-sm text-orange-700">High</div>
                    </div>
                    <div className="rounded-lg bg-yellow-50 p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {cveStats.vulnerabilitiesBySeverity?.MEDIUM || 0}
                      </div>
                      <div className="text-sm text-yellow-700">Medium</div>
                    </div>
                    <div className="rounded-lg bg-green-50 p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {cveStats.vulnerabilitiesBySeverity?.LOW || 0}
                      </div>
                      <div className="text-sm text-green-700">Low</div>
                    </div>
                  </div>
                </div>

                {/* Quick Info */}
                <div>
                  <h4 className="text-md mb-4 font-medium text-gray-900">
                    Quick Info
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span>Total Vulnerabilities:</span>
                      <span>
                        {cveStats.totalVulnerabilities?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Issues:</span>
                      <span>
                        {cveStats.totalEndpointVulnerabilities?.toLocaleString() ||
                          0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Recent (7d):</span>
                      <span>{cveStats.recentlyDetected || 0}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="text-xs text-gray-500">
                        Last updated: {new Date().toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="mb-4 text-6xl">📊</div>
                <h3 className="mb-2 text-lg font-medium text-gray-900">
                  No CVE Data
                </h3>
                <p className="mb-4 text-gray-600">
                  Click "Sync All CVEs" to import vulnerability data from
                  SentinelOne.
                </p>
                <p className="text-sm text-gray-500">
                  This will import 107,523+ CVE records and may take 30-60
                  minutes.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sync History */}
        {cveSyncHistory && cveSyncHistory.length > 0 && (
          <div className="rounded-lg bg-white shadow">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-medium text-gray-900">
                Recent CVE Sync History
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {cveSyncHistory.map((job: any) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between border-b border-gray-100 py-2 last:border-b-0"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        CVE Sync - {new Date(job.startedAt).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {job.recordsProcessed.toLocaleString()} records
                        processed
                        {job.completedAt &&
                          ` in ${Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)}s`}
                      </div>
                    </div>
                    <div
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        job.status === "COMPLETED"
                          ? "bg-green-100 text-green-800"
                          : job.status === "RUNNING"
                            ? "bg-blue-100 text-blue-800"
                            : job.status === "FAILED"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {job.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // RESTORED: Original Security Tab (you can customize this)
  const renderSecurity = () => (
    <div className="space-y-6">
      <div className="rounded-lg border p-6">
        <h3 className="mb-4 text-lg font-semibold">Security Overview</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <h4 className="font-medium text-gray-700">Active Threats</h4>
            <div className="mt-2 text-2xl font-bold text-red-600">
              {globalMetrics?.totalThreats || 0}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium text-gray-700">Critical CVEs</h4>
            <div className="mt-2 text-2xl font-bold text-orange-600">
              {globalMetrics?.criticalVulns || 0}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium text-gray-700">Compliance Rate</h4>
            <div className="mt-2 text-2xl font-bold text-green-600">
              {globalMetrics?.averageCompliance || 0}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // RESTORED: Original Compliance Tab
  const renderCompliance = () => (
    <div className="space-y-6">
      <div className="rounded-lg border p-6">
        <h3 className="mb-4 text-lg font-semibold">Compliance Management</h3>
        <p className="text-gray-600">
          Compliance monitoring and Windows version tracking functionality.
        </p>
      </div>
    </div>
  );

  // RESTORED: Original Tenants Tab
  const renderTenants = () => (
    <TenantManagementTab
      tenantData={tenantData?.all || []}
      tenantsLoading={tenantsLoading}
      onDeleteClick={setShowDeleteModal}
    />
  );

  // RESTORED: Original SentinelOne Tab
  const renderSentinelOne = () => (
    <SentinelOneTab
      diagnostics={diagnostics}
      testConnection={testConnection}
      testingConnection={testingConnection}
      fullSync={fullSync}
      isSyncing={isSyncing}
    />
  );

  if (tenantsLoading) {
    return <div className="p-8 text-center">Loading dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Admin Dashboard
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                Welcome, {session.user?.email}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white shadow">
        <div className="px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { key: "overview", label: "Overview", icon: "📊" },
              { key: "security", label: "Security", icon: "🔒" },
              { key: "vulnerabilities", label: "Vulnerabilities", icon: "🛡️" },
              { key: "compliance", label: "Compliance", icon: "✅" },
              { key: "tenants", label: "Tenants", icon: "🏢" },
              { key: "sentinelone", label: "SentinelOne", icon: "🔗" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`border-b-2 px-1 py-4 text-sm font-medium ${
                  activeTab === tab.key
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {activeTab === "overview" && renderOverview()}
          {activeTab === "security" && renderSecurity()}
          {activeTab === "vulnerabilities" && renderVulnerabilities()}
          {activeTab === "compliance" && renderCompliance()}
          {activeTab === "tenants" && renderTenants()}
          {activeTab === "sentinelone" && renderSentinelOne()}
        </div>
      </div>
    </div>
  );
}

// RESTORED: Original helper components
function OverviewStatsGrid({ overview, cveStats }: any) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{overview.tenant.name} Overview</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
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
            {(overview.stats.vulnerabilities.critical || 0) +
              (cveStats?.vulnerabilitiesBySeverity?.CRITICAL || 0)}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <h4 className="font-medium text-gray-700">Total Endpoints</h4>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {overview.stats.endpoints.total}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <h4 className="font-medium text-gray-700">CVE Count</h4>
          <div className="mt-2 text-2xl font-bold text-purple-600">
            {cveStats?.totalEndpointVulnerabilities || 0}
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantThreatsList({ tenantData }: any) {
  if (!tenantData || tenantData.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Tenant Threats</h3>
        <div className="py-8 text-center text-gray-500">
          <div className="mb-2 text-4xl">🔒</div>
          <p>No tenants available to display threat information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Tenant Threats</h3>
      <div className="space-y-4">
        {tenantData.map((tenant: any) => (
          <TenantThreatRow key={tenant.id} tenant={tenant} />
        ))}
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
          {tenant.endpoints?.length || 0} endpoints
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
  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6">
        <h3 className="mb-4 text-lg font-semibold">Tenant Management</h3>
        <p className="mb-4 text-gray-600">
          Manage tenants and their configurations.
        </p>
        {tenantsLoading ? (
          <div>Loading tenants...</div>
        ) : tenantData && tenantData.length > 0 ? (
          <div className="space-y-2">
            {tenantData.map((tenant: any) => (
              <div
                key={tenant.id}
                className="flex items-center justify-between rounded border p-3"
              >
                <div>
                  <h4 className="font-medium">{tenant.name}</h4>
                  <p className="text-sm text-gray-600">
                    {tenant.endpoints?.length || 0} endpoints
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Link
                    href={`/tenant/${tenant.slug}/dashboard`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">
            <div className="mb-2 text-4xl">🏢</div>
            <p>
              No tenants found. Set up SentinelOne integration to sync tenants.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SentinelOneTab({
  diagnostics,
  testConnection,
  testingConnection,
  fullSync,
  isSyncing,
}: any) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6">
        <h3 className="mb-4 text-lg font-semibold">SentinelOne Integration</h3>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h4 className="text-md mb-4 font-medium text-gray-900">Actions</h4>
            <div className="space-y-3">
              <button
                onClick={() => testConnection()}
                disabled={testingConnection}
                className="inline-flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {testingConnection ? "Testing..." : "Test Connection"}
              </button>
              <button
                onClick={() => fullSync()}
                disabled={isSyncing}
                className="inline-flex w-full items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {isSyncing ? "Syncing..." : "Full Agent Sync"}
              </button>
              <button
                onClick={async () => {
                  try {
                    console.log("Testing CVE stats...");
                    const stats =
                      await api.cveManagement.getSyncStatistics.query();
                    console.log("CVE Stats:", stats);
                  } catch (error) {
                    console.error("CVE Router Error:", error);
                  }
                }}
                className="rounded bg-purple-600 px-4 py-2 text-white"
              >
                Test CVE Router
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-md mb-4 font-medium text-gray-900">Status</h4>
            <div className="space-y-2 text-sm">
              {diagnostics && (
                <>
                  <div className="flex justify-between">
                    <span>SentinelOne Sites:</span>
                    <span>{diagnostics.sentinelOneSites || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Agents:</span>
                    <span>{diagnostics.totalAgents || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Synced Agents:</span>
                    <span>{diagnostics.syncedAgents || 0}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
