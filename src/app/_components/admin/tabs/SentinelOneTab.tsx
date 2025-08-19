// Create src/app/_components/admin/tabs/SentinelOneTab.tsx
import { MetricCard } from "../ui/MetricCard";
import { StatGrid } from "../ui/StatGrid";
import { ActionButton } from "../ui/ActionButton";

interface SentinelOneTabProps {
  diagnostics: any;
  testConnection: () => void;
  testingConnection: boolean;
  fullSync: () => void;
  isSyncing: boolean;
}

export function SentinelOneTab({
  diagnostics,
  testConnection,
  testingConnection,
  fullSync,
  isSyncing,
}: SentinelOneTabProps) {
  const isConnected = diagnostics?.status === "connected";

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">
        SentinelOne Integration
      </h2>

      {/* Connection Status */}
      <StatGrid columns={3}>
        <MetricCard
          title="Connection Status"
          value={isConnected ? "Connected" : "Disconnected"}
          icon={isConnected ? "✅" : "❌"}
          color={isConnected ? "green" : "red"}
        />
        <MetricCard
          title="API Endpoint"
          value={diagnostics?.endpoint ? "Configured" : "Not Set"}
          icon="🔗"
          color={diagnostics?.endpoint ? "blue" : "orange"}
        />
        <MetricCard
          title="Last Sync"
          value={
            diagnostics?.lastSync
              ? new Date(diagnostics.lastSync).toLocaleDateString()
              : "Never"
          }
          icon="🔄"
          color="purple"
        />
      </StatGrid>

      {/* Diagnostic Information */}
      {diagnostics && (
        <div className="rounded-lg border bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold">Diagnostic Information</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium text-gray-700">Configuration</h4>
              <div className="mt-2 text-sm text-gray-600">
                <div>Endpoint: {diagnostics.endpoint || "Not configured"}</div>
                <div>
                  API Key: {diagnostics.apiKey ? "Configured" : "Not set"}
                </div>
                <div>Status: {diagnostics.status}</div>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-700">Statistics</h4>
              <div className="mt-2 text-sm text-gray-600">
                <div>Total Endpoints: {diagnostics.totalEndpoints || 0}</div>
                <div>Active Threats: {diagnostics.activeThreats || 0}</div>
                <div>
                  Last Updated:{" "}
                  {diagnostics.lastSync
                    ? new Date(diagnostics.lastSync).toLocaleString()
                    : "Never"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold">Actions</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <h4 className="font-medium">Test Connection</h4>
              <p className="text-sm text-gray-600">
                Verify SentinelOne API connectivity
              </p>
            </div>
            <ActionButton onClick={testConnection} loading={testingConnection}>
              Test Connection
            </ActionButton>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <h4 className="font-medium">Full Sync</h4>
              <p className="text-sm text-gray-600">
                Synchronize all data from SentinelOne
              </p>
            </div>
            <ActionButton
              onClick={fullSync}
              loading={isSyncing}
              variant="primary"
            >
              {isSyncing ? "Syncing..." : "Full Sync"}
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
