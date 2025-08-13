// components/admin/tabs/ComplianceTab.tsx
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
