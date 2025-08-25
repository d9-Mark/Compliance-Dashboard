// Replace src/app/_components/admin/tabs/OverviewTab.tsx
import { MetricCard } from "../ui/MetricCard";
import { StatGrid } from "../ui/StatGrid";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { DataTable } from "../ui/DataTable";
import { DonutChart, ProgressBar, TrendIndicator } from "../ui/SimpleChart";
import { ExecutiveSummary } from "../ui/ExecutiveSummary";

interface OverviewTabProps {
  globalMetrics: any;
  cveStats: any;
  selectedTenantId: string | null;
  overview: any;
  cveAvailable: boolean;
  tenantData: any;
  onTenantSelect: (tenantId: string) => void;
  // New props for better error handling
  hasErrors?: boolean;
  isLoadingAny?: boolean;
  tenantsError?: any;
  cveStatsError?: any;
}

export function OverviewTab({
  globalMetrics,
  cveStats,
  selectedTenantId,
  overview,
  cveAvailable,
  tenantData,
  onTenantSelect,
  hasErrors = false,
  isLoadingAny = false,
  tenantsError,
  cveStatsError,
}: OverviewTabProps) {
  // Enhanced loading state
  if (isLoadingAny && !globalMetrics) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="mb-4 h-6 w-48 rounded bg-gray-200"></div>
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-gray-200"></div>
            ))}
          </div>
        </div>
        <LoadingSpinner size="lg" message="Loading dashboard data..." />
      </div>
    );
  }

  // Error state with specific error details
  if (hasErrors && !globalMetrics) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-400">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Dashboard Loading Error
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>Unable to load dashboard data. Please try refreshing the page.</p>
                {tenantsError && (
                  <p className="mt-1">• Tenant data: {tenantsError.message}</p>
                )}
                {cveStatsError && (
                  <p className="mt-1">• CVE data: {cveStatsError.message}</p>
                )}
              </div>
              <div className="mt-4">
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-200"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!globalMetrics) {
    return <LoadingSpinner size="lg" message="Loading overview..." />;
  }

  const complianceRate = Math.round(globalMetrics.averageCompliance);
  const criticalIssues =
    globalMetrics.criticalVulns + globalMetrics.totalThreats;

  // Prepare tenant selection data
  const tenantSelectData =
    tenantData?.all?.map((tenant: any) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      endpoints: tenant._count?.endpoints || 0,
    })) || [];

  const tenantColumns = [
    { key: "name", label: "Tenant Name" },
    { key: "endpoints", label: "Endpoints" },
    {
      key: "actions",
      label: "Actions",
      render: (_, tenant: any) => (
        <div className="flex space-x-2">
          <button
            onClick={() => onTenantSelect(tenant.id)}
            className="rounded bg-blue-100 px-3 py-1 text-sm text-blue-700 hover:bg-blue-200"
          >
            Quick View
          </button>
          <button
            onClick={() =>
              window.open(`/tenant/${tenant.slug}/dashboard`, "_blank")
            }
            className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
          >
            Full Dashboard
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Executive Summary - Top-level insights */}
      <ExecutiveSummary 
        globalMetrics={globalMetrics}
        cveStats={cveStats}
        tenantCount={globalMetrics.totalTenants}
      />

      {/* Security Health - Grouped by Risk Level */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Immediate Attention Required */}
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <div className="mb-4 flex items-center">
            <div className="rounded-full bg-red-100 p-2">
              <span className="text-lg">🚨</span>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-red-800">Immediate Action Required</h3>
              <p className="text-sm text-red-600">Issues that need your attention now</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-white p-3">
              <div>
                <div className="font-medium text-gray-900">Critical Vulnerabilities</div>
                <div className="text-sm text-gray-600">High-risk security issues</div>
              </div>
              <div className="text-2xl font-bold text-red-600">
                {globalMetrics.criticalVulns}
              </div>
            </div>
            
            <div className="flex items-center justify-between rounded-lg bg-white p-3">
              <div>
                <div className="font-medium text-gray-900">Active Threats</div>
                <div className="text-sm text-gray-600">Detected malicious activity</div>
              </div>
              <div className="text-2xl font-bold text-red-600">
                {globalMetrics.totalThreats}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-white p-3">
              <div>
                <div className="font-medium text-gray-900">Non-Compliant Endpoints</div>
                <div className="text-sm text-gray-600">Devices needing updates</div>
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {Math.round(globalMetrics.totalEndpoints - (globalMetrics.totalEndpoints * complianceRate) / 100)}
              </div>
            </div>
          </div>
          
          {(globalMetrics.criticalVulns > 0 || globalMetrics.totalThreats > 0) && (
            <div className="mt-4 rounded-lg bg-red-100 p-3">
              <div className="text-sm font-medium text-red-800">
                🔥 {globalMetrics.criticalVulns + globalMetrics.totalThreats} critical issues require immediate remediation
              </div>
            </div>
          )}
        </div>

        {/* Security Monitoring Status */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
          <div className="mb-4 flex items-center">
            <div className="rounded-full bg-blue-100 p-2">
              <span className="text-lg">🛡️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-blue-800">Security Monitoring</h3>
              <p className="text-sm text-blue-600">Overall vulnerability landscape</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-white p-3">
              <div>
                <div className="font-medium text-gray-900">Total Vulnerabilities</div>
                <div className="text-sm text-gray-600">All tracked security issues</div>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {globalMetrics.totalVulnerabilities}
              </div>
            </div>
            
            <div className="flex items-center justify-between rounded-lg bg-white p-3">
              <div>
                <div className="font-medium text-gray-900">High Priority Issues</div>
                <div className="text-sm text-gray-600">Significant security concerns</div>
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {globalMetrics.highVulns || 0}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-white p-3">
              <div>
                <div className="font-medium text-gray-900">Medium & Low Issues</div>
                <div className="text-sm text-gray-600">Manageable security items</div>
              </div>
              <div className="text-2xl font-bold text-gray-600">
                {(globalMetrics.mediumVulns || 0) + (globalMetrics.lowVulns || 0)}
              </div>
            </div>
          </div>
          
          <div className="mt-4 space-y-3">
            <ProgressBar
              value={globalMetrics.criticalVulns + globalMetrics.highVulns}
              max={globalMetrics.totalVulnerabilities}
              label="High Priority Issues"
              color="red"
              size="sm"
            />
            
            <div className="rounded-lg bg-blue-100 p-3">
              <div className="text-sm text-blue-800">
                💡 <strong>Insight:</strong> Focus on the {globalMetrics.criticalVulns + globalMetrics.highVulns} high-priority issues first for maximum security impact
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions & Help */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
            <p className="text-sm text-gray-600">Common administrative tasks</p>
          </div>
          <div className="rounded-lg bg-blue-50 px-3 py-1 text-xs text-blue-700">
            Need help? Check the knowledge base
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <button className="rounded-lg border border-gray-200 p-4 text-left hover:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🔄</span>
              <div>
                <div className="font-medium text-gray-900">Sync Data</div>
                <div className="text-sm text-gray-600">Update from SentinelOne</div>
              </div>
            </div>
          </button>
          
          <button className="rounded-lg border border-gray-200 p-4 text-left hover:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">📊</span>
              <div>
                <div className="font-medium text-gray-900">Generate Report</div>
                <div className="text-sm text-gray-600">Executive summary</div>
              </div>
            </div>
          </button>
          
          <button className="rounded-lg border border-gray-200 p-4 text-left hover:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">⚙️</span>
              <div>
                <div className="font-medium text-gray-900">Manage D9 Apps</div>
                <div className="text-sm text-gray-600">Configure filtering</div>
              </div>
            </div>
          </button>
          
          <button className="rounded-lg border border-gray-200 p-4 text-left hover:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🏢</span>
              <div>
                <div className="font-medium text-gray-900">Add Tenant</div>
                <div className="text-sm text-gray-600">Onboard new client</div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Tenant Management - Simplified */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Client Organizations</h3>
            <p className="text-sm text-gray-600">
              {tenantSelectData.length} active clients • Click to view details
            </p>
          </div>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Add New Client
          </button>
        </div>
        
        {tenantSelectData.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tenantSelectData.slice(0, 6).map((tenant: any) => (
              <div
                key={tenant.id}
                className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onTenantSelect(tenant.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{tenant.name}</div>
                    <div className="text-sm text-gray-600">
                      {tenant.endpoints} endpoints
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                      Active
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTenantSelect(tenant.id);
                    }}
                    className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200"
                  >
                    Quick View
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/tenant/${tenant.slug}/dashboard`, "_blank");
                    }}
                    className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
                  >
                    Full Dashboard
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <div className="text-gray-400 mb-2">🏢</div>
            <div className="text-sm text-gray-600 mb-2">No client organizations yet</div>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Add Your First Client
            </button>
          </div>
        )}
        
        {tenantSelectData.length > 6 && (
          <div className="mt-4 text-center">
            <button className="text-sm text-blue-600 hover:text-blue-700">
              View all {tenantSelectData.length} clients →
            </button>
          </div>
        )}
      </div>

      {/* Selected Tenant Overview - Enhanced */}
      {selectedTenantId && overview && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-green-800">
                📊 {overview.tenant.name} - Detailed View
              </h3>
              <p className="text-sm text-green-600">
                Real-time security overview for this client
              </p>
            </div>
            <button
              onClick={() => onTenantSelect("")}
              className="rounded-lg bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 border"
            >
              ✕ Close
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Metrics */}
            <div className="space-y-4">
              <div className="rounded-lg bg-white p-4">
                <div className="mb-3 font-medium text-gray-900">Endpoint Status</div>
                <ProgressBar
                  value={overview.stats.endpoints.compliant}
                  max={overview.stats.endpoints.total}
                  label="Compliance Rate"
                  color="green"
                />
                <div className="mt-2 text-sm text-gray-600">
                  {overview.stats.endpoints.compliant} of {overview.stats.endpoints.total} endpoints compliant
                </div>
              </div>
              
              <div className="rounded-lg bg-white p-4">
                <div className="mb-3 font-medium text-gray-900">Security Issues</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Critical:</span>
                    <span className="font-medium text-red-600">
                      {overview.stats.vulnerabilities.critical || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>High:</span>
                    <span className="font-medium text-orange-600">
                      {overview.stats.vulnerabilities.high || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Medium/Low:</span>
                    <span className="font-medium text-gray-600">
                      {(overview.stats.vulnerabilities.medium || 0) + (overview.stats.vulnerabilities.low || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="space-y-4">
              <div className="rounded-lg bg-white p-4">
                <div className="mb-3 font-medium text-gray-900">Quick Actions</div>
                <div className="space-y-2">
                  <button
                    onClick={() => window.open(`/tenant/${overview.tenant.slug}/dashboard`, "_blank")}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Open Full Dashboard
                  </button>
                  <button className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Generate Report
                  </button>
                  <button className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Schedule Sync
                  </button>
                </div>
              </div>
              
              {(overview.stats.vulnerabilities.critical > 0) && (
                <div className="rounded-lg bg-red-100 p-4 border border-red-200">
                  <div className="text-sm font-medium text-red-800 mb-2">
                    ⚠️ Attention Required
                  </div>
                  <div className="text-sm text-red-700">
                    This client has {overview.stats.vulnerabilities.critical} critical vulnerabilities that need immediate attention.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced System Status with real-time indicators */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="text-sm">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-gray-700">🔍 System Status</div>
            <div className="flex items-center space-x-2">
              {isLoadingAny && (
                <div className="flex items-center text-blue-600">
                  <div className="mr-1 h-2 w-2 animate-pulse rounded-full bg-blue-400"></div>
                  <span className="text-xs">Updating</span>
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 space-y-1 text-gray-600">
            <div className="flex justify-between">
              <span>CVE Integration:</span>
              <span className={cveAvailable ? "text-green-600" : "text-red-600"}>
                {cveAvailable ? "✅ Active" : "❌ Inactive"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Selected Tenant:</span>
              <span>{selectedTenantId || "None"}</span>
            </div>
            <div className="flex justify-between">
              <span>Data Sources:</span>
              <span>SentinelOne, CVE Database</span>
            </div>
            <div className="flex justify-between">
              <span>Dashboard Status:</span>
              <span className={hasErrors ? "text-yellow-600" : "text-green-600"}>
                {hasErrors ? "⚠️ Partial" : "✅ Healthy"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
