// Create src/app/_components/admin/tabs/VulnerabilitiesTab.tsx
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
              CVE management features are not currently enabled.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">CVE Management</h2>
        <button
          onClick={syncCVEs}
          disabled={isSyncing}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSyncing ? "Syncing..." : "Sync CVEs"}
        </button>
      </div>

      {/* CVE Statistics */}
      {cveStats && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">CVE Statistics</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-blue-500 p-6 text-white">
              <p className="text-sm font-medium text-white/80">Total CVEs</p>
              <p className="mt-2 text-3xl font-bold">
                {cveStats.totalVulnerabilities || 0}
              </p>
              <div className="text-2xl opacity-70">🛡️</div>
            </div>

            <div className="rounded-lg border bg-red-500 p-6 text-white">
              <p className="text-sm font-medium text-white/80">Critical</p>
              <p className="mt-2 text-3xl font-bold">
                {cveStats.vulnerabilitiesBySeverity?.CRITICAL || 0}
              </p>
              <div className="text-2xl opacity-70">🔥</div>
            </div>

            <div className="rounded-lg border bg-orange-500 p-6 text-white">
              <p className="text-sm font-medium text-white/80">High</p>
              <p className="mt-2 text-3xl font-bold">
                {cveStats.vulnerabilitiesBySeverity?.HIGH || 0}
              </p>
              <div className="text-2xl opacity-70">⚠️</div>
            </div>

            <div className="rounded-lg border bg-purple-500 p-6 text-white">
              <p className="text-sm font-medium text-white/80">Active Issues</p>
              <p className="mt-2 text-3xl font-bold">
                {cveStats.totalEndpointVulnerabilities || 0}
              </p>
              <div className="text-2xl opacity-70">💻</div>
            </div>
          </div>
        </div>
      )}

      {/* Sync History */}
      {cveSyncHistory && cveSyncHistory.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">Recent Sync History</h3>
          <div className="overflow-hidden rounded-lg border bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Records
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {cveSyncHistory.map((item: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                      {new Date(item.startedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                      {item.status}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                      {item.recordsProcessed}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                      {Math.round(item.duration / 1000)}s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
