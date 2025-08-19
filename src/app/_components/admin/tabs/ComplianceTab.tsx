// Create src/app/_components/admin/tabs/ComplianceTab.tsx
import { MetricCard } from "../ui/MetricCard";
import { StatGrid } from "../ui/StatGrid";

interface ComplianceTabProps {
  globalMetrics: any;
  tenantData: any;
}

export function ComplianceTab({
  globalMetrics,
  tenantData,
}: ComplianceTabProps) {
  if (!globalMetrics) {
    return <div className="p-8 text-center">Loading compliance data...</div>;
  }

  const complianceRate = Math.round(globalMetrics.averageCompliance);
  const nonCompliantEndpoints =
    globalMetrics.totalEndpoints -
    Math.round((globalMetrics.totalEndpoints * complianceRate) / 100);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">
        Compliance Dashboard
      </h2>

      {/* Compliance Metrics */}
      <StatGrid columns={4}>
        <MetricCard
          title="Overall Compliance"
          value={`${complianceRate}%`}
          icon="✅"
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
                : "warning"
          }
        />
        <MetricCard
          title="Compliant Endpoints"
          value={Math.round(
            (globalMetrics.totalEndpoints * complianceRate) / 100,
          )}
          icon="🟢"
          color="green"
        />
        <MetricCard
          title="Non-Compliant"
          value={nonCompliantEndpoints}
          icon="🔴"
          color="red"
          urgent={nonCompliantEndpoints > 0}
        />
        <MetricCard
          title="Compliance Score"
          value={`${Math.max(0, 100 - globalMetrics.totalThreats - globalMetrics.criticalVulns)}/100`}
          icon="📊"
          color="blue"
        />
      </StatGrid>

      {/* Compliance Actions */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold">Compliance Actions</h3>
        <div className="space-y-4">
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <h4 className="font-medium text-yellow-800">Recommendations</h4>
            <ul className="mt-2 space-y-1 text-sm text-yellow-700">
              {complianceRate < 80 && (
                <li>• Focus on bringing compliance rate above 80%</li>
              )}
              {globalMetrics.criticalVulns > 0 && (
                <li>
                  • Address {globalMetrics.criticalVulns} critical
                  vulnerabilities
                </li>
              )}
              {globalMetrics.totalThreats > 0 && (
                <li>
                  • Investigate {globalMetrics.totalThreats} active threats
                </li>
              )}
              {nonCompliantEndpoints > 0 && (
                <li>
                  • Update {nonCompliantEndpoints} non-compliant endpoints
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Create src/app/_components/admin/tabs/TenantsTab.tsx
import { DataTable } from "../ui/DataTable";
import { ActionButton } from "../ui/ActionButton";
import { LoadingSpinner } from "../ui/LoadingSpinner";

interface TenantsTabProps {
  tenantData: any[];
  tenantsLoading: boolean;
  onDeleteClick: (tenant: any) => void;
}

export function TenantsTab({
  tenantData,
  tenantsLoading,
  onDeleteClick,
}: TenantsTabProps) {
  if (tenantsLoading) {
    return <LoadingSpinner size="lg" message="Loading tenants..." />;
  }

  const columns = [
    { key: "name", label: "Name" },
    { key: "slug", label: "Slug" },
    {
      key: "_count",
      label: "Endpoints",
      render: (count: any) => count?.endpoints || 0,
    },
    {
      key: "complianceRate",
      label: "Compliance",
      render: (rate: number) => (
        <span
          className={`font-semibold ${rate >= 80 ? "text-green-600" : rate >= 60 ? "text-orange-600" : "text-red-600"}`}
        >
          {rate || 0}%
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, tenant: any) => (
        <div className="flex space-x-2">
          <ActionButton
            size="sm"
            variant="secondary"
            onClick={() =>
              window.open(`/tenant/${tenant.slug}/dashboard`, "_blank")
            }
          >
            View
          </ActionButton>
          <ActionButton
            size="sm"
            variant="danger"
            onClick={() => onDeleteClick(tenant)}
          >
            Delete
          </ActionButton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Tenant Management
        </h2>
        <ActionButton variant="primary">Add Tenant</ActionButton>
      </div>

      <DataTable
        columns={columns}
        data={tenantData}
        emptyMessage="No tenants found"
      />
    </div>
  );
}
