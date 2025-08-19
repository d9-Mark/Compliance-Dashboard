// Replace src/app/_components/admin/tabs/SecurityTab.tsx
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

  // Use actual compliance data from your database fields
  const tableData = (tenantData?.all || []).map((tenant: any) => {
    const endpoints = tenant.endpoints || [];
    const totalEndpoints = endpoints.length;

    // Use windowsCompliant field that's already populated by your sync
    const windowsCompliantEndpoints = endpoints.filter(
      (e: any) => e.windowsCompliant === true,
    ).length;
    const complianceRate =
      totalEndpoints > 0
        ? Math.round((windowsCompliantEndpoints / totalEndpoints) * 100)
        : 0;

    // Use activeThreats field from SentinelOne sync
    const activeThreats = endpoints.reduce(
      (sum: number, e: any) => sum + (e.activeThreats || 0),
      0,
    );

    // Additional metrics from your database
    const avgComplianceScore =
      totalEndpoints > 0
        ? Math.round(
            endpoints.reduce(
              (sum: number, e: any) => sum + (e.windowsComplianceScore || 0),
              0,
            ) / totalEndpoints,
          )
        : 0;

    const criticalIssues = endpoints.reduce(
      (sum: number, e: any) => sum + (e.criticalVulns || 0),
      0,
    );

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      totalEndpoints,
      complianceRate,
      activeThreats,
      avgComplianceScore,
      criticalIssues,
    };
  });

  const columns = [
    { key: "name", label: "Tenant" },
    {
      key: "totalEndpoints",
      label: "Endpoints",
      render: (endpoints: number) => endpoints.toString(),
    },
    {
      key: "complianceRate",
      label: "Windows Compliance",
      render: (rate: number) => {
        const colorClass =
          rate >= 90
            ? "text-green-600"
            : rate >= 70
              ? "text-yellow-600"
              : "text-red-600";
        return <span className={`font-semibold ${colorClass}`}>{rate}%</span>;
      },
    },
    {
      key: "avgComplianceScore",
      label: "Avg Score",
      render: (score: number) => {
        const colorClass =
          score >= 90
            ? "text-green-600"
            : score >= 70
              ? "text-yellow-600"
              : "text-red-600";
        return <span className={`text-sm ${colorClass}`}>{score}/100</span>;
      },
    },
    {
      key: "activeThreats",
      label: "Active Threats",
      render: (threats: number) => {
        const colorClass = threats === 0 ? "text-green-600" : "text-red-600";
        return <span className={`font-semibold ${colorClass}`}>{threats}</span>;
      },
    },
    {
      key: "criticalIssues",
      label: "Critical Vulns",
      render: (vulns: number) => {
        const colorClass = vulns === 0 ? "text-green-600" : "text-red-600";
        return <span className={`font-semibold ${colorClass}`}>{vulns}</span>;
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, tenant: any) => (
        <button
          onClick={() =>
            window.open(`/tenant/${tenant.slug}/dashboard`, "_blank")
          }
          className="rounded bg-blue-100 px-3 py-1 text-sm text-blue-700 hover:bg-blue-200"
        >
          View Dashboard
        </button>
      ),
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
          data={tableData}
          emptyMessage="No tenant data available"
        />
      </div>
    </div>
  );
}
