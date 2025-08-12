"use client";

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export function WindowsComplianceAdminDashboard() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "endpoints" | "versions" | "sync" | "complianceWidget"
  >("overview");
  const [enabledVersions, setEnabledVersions] = useState<
    Record<string, boolean>
  >({
    "11": true,
    "10": true,
  });
  const [selectedVersionFilter, setSelectedVersionFilter] =
    useState<string>("all");
  const [selectedTenant, setSelectedTenant] = useState<string>("all");
  const [endpointLimit, setEndpointLimit] = useState<number>(50);

  // Queries
  const {
    data: versionRegistry,
    isLoading: versionsLoading,
    refetch: refetchVersions,
  } = api.windowsCompliance.getWindowsVersionRegistry.useQuery();

  const { data: globalSummary, isLoading: summaryLoading } =
    api.windowsCompliance.getGlobalComplianceSummary.useQuery();

  const { mutate: syncVersions, isPending: isSyncing } =
    api.windowsCompliance.syncWindowsVersions.useMutation({
      onSuccess: (result) => {
        refetchVersions();
        alert(
          `✅ Sync completed! ${result.synced} versions processed, ${result.created} created, ${result.updated} updated`,
        );
      },
      onError: (error) => {
        alert(`❌ Sync failed: ${error.message}`);
      },
    });

  const filteredVersions = useMemo(() => {
    if (!versionRegistry?.versions) return [];
    return versionRegistry.versions
      .filter(
        (v) =>
          (v.majorVersion === "10" || v.majorVersion === "11") &&
          !v.majorVersion.includes("Server") &&
          enabledVersions[v.majorVersion],
      )
      .sort((a, b) => {
        if (a.majorVersion !== b.majorVersion) {
          return b.majorVersion.localeCompare(a.majorVersion);
        }
        return (
          new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
        );
      });
  }, [versionRegistry, enabledVersions]);

  const latestBuilds = useMemo(() => {
    const latest: Record<string, any> = {};
    filteredVersions.forEach((v) => {
      if (
        !latest[v.majorVersion] ||
        new Date(v.releaseDate) > new Date(latest[v.majorVersion].releaseDate)
      ) {
        latest[v.majorVersion] = v;
      }
    });
    return latest;
  }, [filteredVersions]);

  const isLoading = versionsLoading || summaryLoading;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading Windows compliance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Windows 10/11 Compliance Details
          </h2>
          <p className="text-gray-600">
            Detailed analysis of Windows 10 and 11 build compliance
          </p>
        </div>
        <VersionToggle
          enabledVersions={enabledVersions}
          onToggle={setEnabledVersions}
        />
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title="Windows 10/11 Endpoints"
          value={globalSummary?.totalWindowsEndpoints || 0}
          subtitle={`${globalSummary?.complianceOverview.complianceRate || 0}% up-to-date`}
          icon="💻"
          color={
            globalSummary?.complianceOverview.complianceRate >= 90
              ? "green"
              : "orange"
          }
        />
        <StatsCard
          title="Latest Win 11 Build"
          value={latestBuilds["11"]?.latestBuild.split(".").pop() || "N/A"}
          subtitle={latestBuilds["11"]?.releaseLabel || ""}
          icon="🔥"
          color="blue"
        />
        <StatsCard
          title="Latest Win 10 Build"
          value={latestBuilds["10"]?.latestBuild.split(".").pop() || "N/A"}
          subtitle={latestBuilds["10"]?.releaseLabel || ""}
          icon="📋"
          color="green"
        />
        <StatsCard
          title="Tenants"
          value={globalSummary?.tenants || 0}
          subtitle="Organizations managed"
          icon="🏢"
          color="purple"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <TabButton
            active={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            label="Tenant Overview"
            icon="📊"
          />
          <TabButton
            active={activeTab === "endpoints"}
            onClick={() => setActiveTab("endpoints")}
            label="Endpoint Details"
            icon="🖥️"
          />
          <TabButton
            active={activeTab === "versions"}
            onClick={() => setActiveTab("versions")}
            label="Available Versions"
            icon="📋"
            badge={filteredVersions.length}
          />
          <TabButton
            active={activeTab === "sync"}
            onClick={() => setActiveTab("sync")}
            label="Sync Data"
            icon="🔄"
            loading={isSyncing}
          />
          <TabButton
            active={activeTab === "complianceWidget"}
            onClick={() => setActiveTab("complianceWidget")}
            label="Compliance Widget"
            icon="🧩"
          />
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <TenantOverviewTab
          tenantBreakdown={globalSummary?.tenantBreakdown || []}
        />
      )}
      {activeTab === "endpoints" && (
        <EndpointDetailsTab
          versionFilter={selectedVersionFilter}
          onVersionFilterChange={setSelectedVersionFilter}
          selectedTenant={selectedTenant}
          onTenantChange={setSelectedTenant}
          tenants={globalSummary?.tenantBreakdown || []}
          endpointLimit={endpointLimit}
          setEndpointLimit={setEndpointLimit}
        />
      )}
      {activeTab === "versions" && (
        <AvailableVersionsTab
          versions={filteredVersions}
          latestBuilds={latestBuilds}
        />
      )}
      {activeTab === "sync" && (
        <DataSyncTab
          onSyncVersions={() => syncVersions()}
          isSyncing={isSyncing}
          lastUpdate={filteredVersions[0]?.lastUpdated}
        />
      )}
      {activeTab === "complianceWidget" && <WindowsComplianceWidget />}
    </div>
  );
}

/* ---------------- Tenant Overview Tab ---------------- */
function TenantOverviewTab({ tenantBreakdown }: { tenantBreakdown: any[] }) {
  // Sort by worst compliance and take top 10
  const chartData = [...tenantBreakdown]
    .sort((a, b) => b.nonCompliant - a.nonCompliant)
    .slice(0, 10)
    .map((t) => ({
      name: t.name,
      slug: t.slug,
      nonCompliant: t.nonCompliant,
      compliant: t.compliant,
      complianceRate: t.complianceRate,
    }));

  const COLORS = ["#ef4444", "#f97316", "#facc15", "#22c55e"];

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold">
          Top Non-Compliant Tenants
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
          >
            <XAxis type="number" allowDecimals={false} />
            <YAxis
              dataKey="name"
              type="category"
              width={150}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value, name, props) => {
                if (name === "nonCompliant") {
                  return [`${value} devices`, "Non-Compliant"];
                }
                return value;
              }}
              labelFormatter={(label) => `Tenant: ${label}`}
            />
            <Bar
              dataKey="nonCompliant"
              fill="#ef4444"
              radius={[0, 4, 4, 0]}
              cursor="pointer"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {tenantBreakdown.length > 10 && (
          <div className="mt-4 text-center">
            <span className="text-sm text-gray-500">
              Showing top 10 tenants by non-compliant endpoints
            </span>
          </div>
        )}
      </div>

      {/* Compliance Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <h4 className="text-lg font-semibold text-green-800">
            Excellent Compliance
          </h4>
          <div className="mt-2">
            <div className="text-2xl font-bold text-green-600">
              {tenantBreakdown.filter((t) => t.complianceRate >= 95).length}
            </div>
            <div className="text-sm text-green-700">
              Tenants with 95%+ compliance
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-6">
          <h4 className="text-lg font-semibold text-orange-800">
            Needs Attention
          </h4>
          <div className="mt-2">
            <div className="text-2xl font-bold text-orange-600">
              {tenantBreakdown.filter((t) => t.complianceRate < 80).length}
            </div>
            <div className="text-sm text-orange-700">
              Tenants below 80% compliance
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h4 className="text-lg font-semibold text-blue-800">Total Managed</h4>
          <div className="mt-2">
            <div className="text-2xl font-bold text-blue-600">
              {tenantBreakdown.reduce((sum, t) => sum + t.total, 0)}
            </div>
            <div className="text-sm text-blue-700">Windows endpoints</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Endpoint Details Tab ---------------- */
function EndpointDetailsTab({
  versionFilter,
  onVersionFilterChange,
  selectedTenant,
  onTenantChange,
  tenants,
  endpointLimit,
  setEndpointLimit,
}: {
  versionFilter: string;
  onVersionFilterChange: (filter: string) => void;
  selectedTenant: string;
  onTenantChange: (tenant: string) => void;
  tenants: any[];
  endpointLimit: number;
  setEndpointLimit: (n: number) => void;
}) {
  const { data: analysis, isLoading } =
    api.windowsCompliance.getEndpointAnalysis.useQuery({
      versionFilter: versionFilter as "all" | "10" | "11" | "outdated",
      tenantId: selectedTenant !== "all" ? selectedTenant : undefined,
      limit: endpointLimit,
    });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Analyzing endpoints...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <select
          value={selectedTenant}
          onChange={(e) => onTenantChange(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All Tenants</option>
          {tenants.map((t) => (
            <option key={t.tenantId} value={t.tenantId}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={versionFilter}
          onChange={(e) => onVersionFilterChange(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All Windows Versions</option>
          <option value="11">Windows 11 Only</option>
          <option value="10">Windows 10 Only</option>
          <option value="outdated">Outdated Builds Only</option>
        </select>
        <div className="text-sm text-gray-600">
          Showing {analysis?.endpoints.length || 0} of{" "}
          {analysis?.totalCount || 0} endpoints
        </div>
      </div>

      {/* Summary Cards */}
      {analysis && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="text-2xl font-bold text-green-600">
              {analysis.summary.current}
            </div>
            <div className="text-sm text-green-700">Up to Date</div>
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
            <div className="text-2xl font-bold text-orange-600">
              {analysis.summary.outdated}
            </div>
            <div className="text-sm text-orange-700">Need Updates</div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="text-2xl font-bold text-blue-600">
              {analysis.summary.windows11}
            </div>
            <div className="text-sm text-blue-700">Windows 11</div>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
            <div className="text-2xl font-bold text-purple-600">
              {analysis.summary.windows10}
            </div>
            <div className="text-sm text-purple-700">Windows 10</div>
          </div>
        </div>
      )}

      {/* Endpoint Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
          <h4 className="text-lg font-semibold">Endpoint Analysis</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Hostname
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  OS Version
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Current Build
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Latest Available
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {analysis?.endpoints.map((ep) => (
                <tr key={ep.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
                    {ep.hostname}
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-600">
                    {ep.tenant?.name}
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-600">
                    {ep.operatingSystem}
                  </td>
                  <td className="px-6 py-4 font-mono text-sm whitespace-nowrap text-gray-900">
                    {ep.osVersion || "Unknown"}
                  </td>
                  <td className="px-6 py-4 font-mono text-sm whitespace-nowrap text-gray-600">
                    {ep.latestBuildNumber || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        ep.complianceStatus === "current"
                          ? "bg-green-100 text-green-800"
                          : ep.complianceStatus === "outdated"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {ep.complianceStatus === "current" && "✅ Current"}
                      {ep.complianceStatus === "outdated" && "⚠️ Outdated"}
                      {ep.complianceStatus === "unknown" && "❓ Unknown"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {analysis?.hasMore && (
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 text-center">
            <button
              onClick={() => setEndpointLimit(endpointLimit + 50)}
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Load 50 more endpoints
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Available Versions Tab ---------------- */
function AvailableVersionsTab({
  versions,
  latestBuilds,
}: {
  versions: any[];
  latestBuilds: Record<string, any>;
}) {
  const groupedVersions = versions.reduce(
    (acc, version) => {
      if (!acc[version.majorVersion]) {
        acc[version.majorVersion] = [];
      }
      acc[version.majorVersion].push(version);
      return acc;
    },
    {} as Record<string, any[]>,
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Available Windows Versions</h3>
        <p className="text-sm text-gray-600">
          All Windows 10 and 11 versions tracked from endoflife.date
        </p>
      </div>

      {Object.entries(groupedVersions).map(([majorVersion, versionList]) => (
        <div key={majorVersion} className="rounded-lg bg-white p-6 shadow">
          <h4 className="mb-4 text-lg font-semibold">
            Windows {majorVersion} Versions
            <span className="ml-2 text-sm text-gray-500">
              ({versionList.length} available)
            </span>
          </h4>

          <div className="space-y-3">
            {versionList.map((version) => {
              const isLatest = latestBuilds[majorVersion]?.id === version.id;
              const daysSinceRelease = Math.floor(
                (Date.now() - new Date(version.releaseDate).getTime()) /
                  (1000 * 60 * 60 * 24),
              );

              return (
                <div
                  key={version.id}
                  className={`rounded-lg border p-4 ${
                    isLatest
                      ? "border-blue-200 bg-blue-50"
                      : version.isSupported
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {version.releaseLabel}
                        </span>
                        {isLatest && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                            Latest
                          </span>
                        )}
                        {version.isLTS && (
                          <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                            LTS
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        Build:{" "}
                        <span className="font-mono">{version.latestBuild}</span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Released {daysSinceRelease} days ago
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          version.isSupported
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {version.isSupported ? "Supported" : "End of Life"}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        EOL: {new Date(version.eolDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Data Sync Tab ---------------- */
function DataSyncTab({
  onSyncVersions,
  isSyncing,
  lastUpdate,
}: {
  onSyncVersions: () => void;
  isSyncing: boolean;
  lastUpdate?: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Data Synchronization</h3>
        <p className="text-sm text-gray-600">
          Sync Windows version data from endoflife.date to ensure compliance
          rules are current
        </p>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h4 className="mb-4 text-lg font-semibold">Sync Windows Data</h4>
        <p className="mb-4 text-gray-600">
          Update Windows 10 and 11 version data from Microsoft's lifecycle
          information.
        </p>

        <button
          onClick={onSyncVersions}
          disabled={isSyncing}
          className={`rounded-lg px-6 py-3 font-semibold text-white transition-colors ${
            isSyncing
              ? "cursor-not-allowed bg-gray-400"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isSyncing ? (
            <>
              <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
              Syncing from endoflife.date...
            </>
          ) : (
            "🔄 Sync Windows Versions"
          )}
        </button>

        {lastUpdate && (
          <div className="mt-4 text-sm text-gray-500">
            Last updated: {new Date(lastUpdate).toLocaleString()}
          </div>
        )}
      </div>

      <div className="rounded-lg bg-blue-50 p-6 shadow">
        <h4 className="mb-4 text-lg font-semibold text-blue-800">
          📡 Data Sources
        </h4>
        <div className="space-y-3">
          <div>
            <div className="font-medium">endoflife.date Windows API</div>
            <div className="text-sm text-blue-700">
              https://endoflife.date/api/windows.json
            </div>
            <div className="text-sm text-gray-600">
              Provides Windows client version lifecycle data
            </div>
          </div>
          <div>
            <div className="font-medium">endoflife.date Windows Server API</div>
            <div className="text-sm text-blue-700">
              https://endoflife.date/api/windows-server.json
            </div>
            <div className="text-sm text-gray-600">
              Provides Windows Server version lifecycle data
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-green-50 p-6 shadow">
        <h4 className="mb-4 text-lg font-semibold text-green-800">
          ✅ What Gets Synced
        </h4>
        <ul className="space-y-2 text-sm text-green-700">
          <li>• Windows 10 client versions and builds</li>
          <li>• Windows 11 client versions and builds</li>
          <li>• End-of-life dates and support status</li>
          <li>• Latest available build numbers</li>
          <li>• LTS (Long Term Servicing) designation</li>
        </ul>
      </div>
    </div>
  );
}

/* ---------------- Helper Components ---------------- */
function VersionToggle({
  enabledVersions,
  onToggle,
}: {
  enabledVersions: Record<string, boolean>;
  onToggle: (versions: Record<string, boolean>) => void;
}) {
  return (
    <div className="flex items-center space-x-4">
      <span className="text-sm font-medium text-gray-700">Track versions:</span>
      {["11", "10"].map((version) => (
        <label key={version} className="flex items-center">
          <input
            type="checkbox"
            checked={enabledVersions[version]}
            onChange={(e) =>
              onToggle({
                ...enabledVersions,
                [version]: e.target.checked,
              })
            }
            className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium">Windows {version}</span>
        </label>
      ))}
    </div>
  );
}

function StatsCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: string;
  color: "blue" | "green" | "orange" | "purple";
}) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    orange: "bg-orange-50 border-orange-200",
    purple: "bg-purple-50 border-purple-200",
  };
  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-600">{title}</div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-sm text-gray-500">{subtitle}</div>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  icon,
  badge,
  loading,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
  badge?: number;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
        active
          ? "border-blue-500 text-blue-600"
          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
      }`}
    >
      <span>{icon}</span>
      {label}
      {loading && (
        <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500"></div>
      )}
      {badge !== undefined && badge > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-2 text-xs font-medium text-blue-800">
          {badge}
        </span>
      )}
    </button>
  );
}

function WindowsComplianceWidget() {
  const [isRunning, setIsRunning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const updateComplianceMutation =
    api.windowsCompliance.updateWindowsCompliance.useMutation({
      onSuccess: (data) => {
        setLastResult(data);
        setIsRunning(false);
        setShowResults(true);
        // Auto-hide results after 10 seconds
        setTimeout(() => setShowResults(false), 10000);
      },
      onError: (error) => {
        console.error("Compliance update failed:", error);
        setIsRunning(false);
      },
    });

  const handleRunCompliance = () => {
    setIsRunning(true);
    setShowResults(false);
    updateComplianceMutation.mutate();
  };

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Windows Compliance
          </h3>
          <p className="text-sm text-gray-500">Check build currency</p>
        </div>
        <button
          onClick={handleRunCompliance}
          disabled={isRunning}
          className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            isRunning
              ? "cursor-not-allowed bg-gray-100 text-gray-400"
              : "bg-blue-600 text-white hover:bg-blue-700"
          } `}
        >
          {isRunning ? (
            <div className="flex items-center space-x-2">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
              <span>Running...</span>
            </div>
          ) : (
            "Run Check"
          )}
        </button>
      </div>

      {/* Compact Results */}
      {showResults && lastResult && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Processed:</span>
            <span className="font-medium">{lastResult.processed}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Compliance Rate:</span>
            <span
              className={`font-medium ${
                lastResult.complianceRate >= 80
                  ? "text-green-600"
                  : lastResult.complianceRate >= 60
                    ? "text-yellow-600"
                    : "text-red-600"
              }`}
            >
              {lastResult.complianceRate}%
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full transition-all duration-500 ${
                lastResult.complianceRate >= 80
                  ? "bg-green-500"
                  : lastResult.complianceRate >= 60
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${lastResult.complianceRate}%` }}
            ></div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-center">
              <div className="font-medium text-green-600">
                {lastResult.compliant}
              </div>
              <div className="text-gray-500">Compliant</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-red-600">
                {lastResult.nonCompliant}
              </div>
              <div className="text-gray-500">Behind</div>
            </div>
          </div>

          {lastResult.errors > 0 && (
            <div className="text-center text-xs text-yellow-600">
              ⚠️ {lastResult.errors} errors
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {updateComplianceMutation.error && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          Error: {updateComplianceMutation.error.message}
        </div>
      )}

      {/* Loading State */}
      {isRunning && (
        <div className="mt-3 text-center text-xs text-gray-500">
          Evaluating endpoints...
        </div>
      )}
    </div>
  );
}
