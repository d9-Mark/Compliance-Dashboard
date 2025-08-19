// Replace src/app/_components/admin/tabs/OverviewTab.tsx
import { MetricCard } from "../ui/MetricCard";
import { StatGrid } from "../ui/StatGrid";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { DataTable } from "../ui/DataTable";

interface OverviewTabProps {
  globalMetrics: any;
  cveStats: any;
  selectedTenantId: string | null;
  overview: any;
  cveAvailable: boolean;
  tenantData: any;
  onTenantSelect: (tenantId: string) => void;
}

export function OverviewTab({
  globalMetrics,
  cveStats,
  selectedTenantId,
  overview,
  cveAvailable,
  tenantData,
  onTenantSelect,
}: OverviewTabProps) {
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

      {/* Global Metrics */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Global Overview
        </h2>
        <StatGrid columns={4}>
          <MetricCard
            title="Total Tenants"
            value={globalMetrics.totalTenants}
            icon="🏢"
            color="blue"
          />
          <MetricCard
            title="Total Endpoints"
            value={globalMetrics.totalEndpoints}
            icon="💻"
            color="purple"
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
              complianceRate >= 90
                ? "excellent"
                : complianceRate >= 70
                  ? "good"
                  : "warning"
            }
          />
          <MetricCard
            title="Critical Issues"
            value={criticalIssues}
            icon="🚨"
            color="red"
            urgent={criticalIssues > 0}
            trend={criticalIssues === 0 ? "excellent" : "critical"}
          />
        </StatGrid>
      </div>

      {/* Security Overview */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Security Overview
        </h2>
        <StatGrid columns={4}>
          <MetricCard
            title="Active Threats"
            value={globalMetrics.totalThreats}
            icon="⚠️"
            color={globalMetrics.totalThreats === 0 ? "green" : "red"}
            urgent={globalMetrics.totalThreats > 0}
          />
          <MetricCard
            title="Total Vulnerabilities"
            value={globalMetrics.totalVulnerabilities}
            icon="🔍"
            color="purple"
          />
          <MetricCard
            title="Critical CVEs"
            value={globalMetrics.criticalVulns}
            icon="🔥"
            color="red"
            urgent={globalMetrics.criticalVulns > 0}
          />
          <MetricCard
            title="Endpoints at Risk"
            value={Math.round(
              globalMetrics.totalEndpoints -
                (globalMetrics.totalEndpoints * complianceRate) / 100,
            )}
            icon="💻"
            color="orange"
          />
        </StatGrid>
      </div>

      {/* CVE Statistics - FIXED */}
      {cveStats && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Vulnerability Statistics
          </h2>
          <StatGrid columns={4}>
            <MetricCard
              title="Total CVEs"
              value={cveStats.totalVulnerabilities || 0}
              icon="🛡️"
              color="blue"
            />
            <MetricCard
              title="Critical"
              value={cveStats.vulnerabilitiesBySeverity?.CRITICAL || 0}
              icon="🔥"
              color="red"
            />
            <MetricCard
              title="High"
              value={cveStats.vulnerabilitiesBySeverity?.HIGH || 0}
              icon="⚠️"
              color="orange"
            />
            <MetricCard
              title="Medium"
              value={cveStats.vulnerabilitiesBySeverity?.MEDIUM || 0}
              icon="📋"
              color="purple"
            />
          </StatGrid>
        </div>
      )}

      {/* Tenant Selection Table */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Tenant Quick Access
        </h2>
        <div className="rounded-lg bg-white p-4">
          <p className="mb-4 text-sm text-gray-600">
            Select a tenant for quick overview or open their full dashboard
          </p>
          <DataTable
            columns={tenantColumns}
            data={tenantSelectData}
            emptyMessage="No tenants available"
          />
        </div>
      </div>

      {/* Selected Tenant Overview */}
      {selectedTenantId && overview && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {overview.tenant.name} - Quick View
          </h2>
          <StatGrid columns={3}>
            <MetricCard
              title="Endpoints"
              value={overview.stats.endpoints.total}
              subtitle={`${overview.stats.endpoints.compliant} compliant`}
              icon="💻"
              color="blue"
            />
            <MetricCard
              title="Compliance Rate"
              value={`${Math.round(
                (overview.stats.endpoints.compliant /
                  overview.stats.endpoints.total) *
                  100,
              )}%`}
              icon="✅"
              color="green"
            />
            <MetricCard
              title="Critical Vulnerabilities"
              value={overview.stats.vulnerabilities.critical || 0}
              icon="🚨"
              color="red"
            />
          </StatGrid>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => onTenantSelect("")}
              className="rounded bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* System Status */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="text-sm">
          <div className="font-semibold text-gray-700">🔍 System Status:</div>
          <div className="mt-2 space-y-1 text-gray-600">
            <div>
              CVE Integration: {cveAvailable ? "✅ Active" : "❌ Inactive"}
            </div>
            <div>Selected Tenant: {selectedTenantId || "None"}</div>
            <div>Data Sources: SentinelOne, CVE Database</div>
          </div>
        </div>
      </div>
    </div>
  );
}
