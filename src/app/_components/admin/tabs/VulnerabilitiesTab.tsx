// components/admin/tabs/VulnerabilitiesTab.tsx
import { MetricCard } from "../ui/MetricCard";
import { StatGrid } from "../ui/StatGrid";
import { ActionButton } from "../ui/ActionButton";
import { DataTable } from "../ui/DataTable";

interface VulnerabilitiesTabProps {
  cveStats: any;
  cveSyncHistory: any;
  cveAvailable: boolean;
  isSyncing: boolean;
  syncCVEs: () => void;
}

export function VulnerabilitiesTab({
  cveStats,
  cveSyncHistory,
  cveAvailable,
  isSyncing,
  syncCVEs,
}: VulnerabilitiesTabProps) {
  if (!cveAvailable) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">CVE Management</h2>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-6">
          <div className="text-center">
            <div className="mb-4 text-4xl">⚠️</div>
            <h3 className="text-lg font-semibold text-orange-800">
              CVE Integration Not Available
            </h3>
            <p className="mt-2 text-orange-700">
              CVE management features are not currently enabled. Please check
              your configuration.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const historyColumns = [
    {
      key: "startedAt",
      label: "Date",
      render: (date: string) => new Date(date).toLocaleString(),
    },
    { key: "status", label: "Status" },
    { key: "recordsProcessed", label: "Records" },
    {
      key: "duration",
      label: "Duration",
      render: (ms: number) => `${Math.round(ms / 1000)}s`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">CVE Management</h2>
        <ActionButton onClick={syncCVEs} loading={isSyncing} variant="primary">
          {isSyncing ? "Syncing..." : "Sync CVEs"}
        </ActionButton>
      </div>

      {/* CVE Statistics */}
      {cveStats && (
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
            title="Affected Endpoints"
            value={cveStats.totalEndpoints || 0}
            icon="💻"
            color="purple"
          />
        </StatGrid>
      )}

      {/* Sync History */}
      {cveSyncHistory && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">Recent Sync History</h3>
          <DataTable
            columns={historyColumns}
            data={cveSyncHistory}
            emptyMessage="No sync history available"
          />
        </div>
      )}

      {/* CVE Actions */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold">CVE Management Actions</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <h4 className="font-medium">Sync All CVEs</h4>
              <p className="text-sm text-gray-600">
                Import latest CVE data from external sources
              </p>
            </div>
            <ActionButton onClick={syncCVEs} loading={isSyncing}>
              Sync Now
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
