// components/admin/tabs/SecurityTab.tsx
import { MetricCard } from "../ui/MetricCard";
import { StatGrid } from "../ui/StatGrid";
import { DataTable } from "../ui/DataTable";

interface SecurityTabProps {
  globalMetrics: any;
  cveStats: any;
  tenantData: any;
}

export function SecurityTab({
  globalMetrics,
  cveStats,
  tenantData,
}: SecurityTabProps) {
  if (!globalMetrics) {
    return <div className="p-8 text-center">Loading security data...</div>;
  }

  const columns = [
    { key: "name", label: "Tenant" },
    {
      key: "endpoints",
      label: "Endpoints",
      render: (endpoints: any[]) => endpoints?.length || 0,
    },
    {
      key: "complianceRate",
      label: "Compliance",
      render: (rate: number) => (
        <span
          className={`font-semibold ${rate >= 80 ? "text-green-600" : rate >= 60 ? "text-orange-600" : "text-red-600"}`}
        >
          {rate}%
        </span>
      ),
    },
    {
      key: "threats",
      label: "Active Threats",
      render: (_, row: any) => {
        const threats =
          row.endpoints?.reduce(
            (sum: number, e: any) => sum + (e.activeThreats || 0),
            0,
          ) || 0;
        return (
          <span
            className={`font-semibold ${threats === 0 ? "text-green-600" : "text-red-600"}`}
          >
            {threats}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">
        Security Dashboard
      </h2>

      {/* Security Metrics */}
      <StatGrid columns={4}>
        <MetricCard
          title="Security Score"
          value={`${Math.max(0, 100 - globalMetrics.totalThreats)}%`}
          icon="🛡️"
          color={globalMetrics.totalThreats === 0 ? "green" : "red"}
        />
        <MetricCard
          title="Threat Level"
          value={
            globalMetrics.totalThreats === 0
              ? "Low"
              : globalMetrics.totalThreats > 10
                ? "High"
                : "Medium"
          }
          icon="⚠️"
          color={
            globalMetrics.totalThreats === 0
              ? "green"
              : globalMetrics.totalThreats > 10
                ? "red"
                : "orange"
          }
        />
        <MetricCard
          title="Protected Endpoints"
          value={`${Math.round(globalMetrics.averageCompliance)}%`}
          icon="🔒"
          color="blue"
        />
        <MetricCard
          title="Risk Assessment"
          value={
            globalMetrics.criticalVulns > 0
              ? "Critical"
              : globalMetrics.totalThreats > 0
                ? "Moderate"
                : "Low"
          }
          icon="📊"
          color={
            globalMetrics.criticalVulns > 0
              ? "red"
              : globalMetrics.totalThreats > 0
                ? "orange"
                : "green"
          }
        />
      </StatGrid>

      {/* Tenant Security Table */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Tenant Security Status</h3>
        <DataTable
          columns={columns}
          data={tenantData?.all || []}
          emptyMessage="No tenant data available"
        />
      </div>
    </div>
  );
}
