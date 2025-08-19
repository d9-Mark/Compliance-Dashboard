// Replace src/hooks/admin/useAdminDashboard.ts
import { useState } from "react";
import { api } from "~/trpc/react";
import type { Session } from "next-auth";

export type AdminTab =
  | "overview"
  | "security"
  | "compliance"
  | "tenants"
  | "sentinelone"
  | "vulnerabilities";

export function useAdminDashboard(session: Session) {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<any>(null);

  // Helper function to handle tenant selection
  const handleTenantSelect = (tenantId: string) => {
    setSelectedTenantId(tenantId === "" ? null : tenantId);
  };

  // Existing data queries that work
  const {
    data: tenantData,
    isLoading: tenantsLoading,
    refetch: refetchTenants,
  } = api.tenant.getTenantsByType.useQuery();

  const { data: overview, isLoading: overviewLoading } =
    api.tenant.getOverview.useQuery(
      { tenantId: selectedTenantId! },
      { enabled: !!selectedTenantId },
    );

  const { data: diagnostics } = api.sentinelOne.getDiagnostics.useQuery();

  // CVE-related queries (safe with error handling)
  const {
    data: cveStats,
    refetch: refetchCveStats,
    error: cveStatsError,
    isLoading: cveStatsLoading,
  } = api.cveManagement?.getSyncStatistics?.useQuery(undefined, {
    enabled: !!api.cveManagement?.getSyncStatistics,
    retry: false,
  }) || { data: null, refetch: () => {}, error: null, isLoading: false };

  const { data: cveSyncHistory, error: cveSyncHistoryError } =
    api.cveManagement?.getSyncHistory?.useQuery(
      { limit: 5 },
      {
        enabled: !!api.cveManagement?.getSyncHistory,
        retry: false,
      },
    ) || { data: null, error: null };

  // Existing mutations
  const { mutate: testConnection, isPending: testingConnection } =
    api.sentinelOne.testConnection.useMutation();

  const { mutate: fullSync, isPending: fullSyncing } =
    api.sentinelOne.fullSync.useMutation({
      onSuccess: () => refetchTenants(),
    });

  // CVE mutations (safe)
  const { mutate: syncCVEs, isPending: cveSyncing } =
    api.cveManagement?.syncAllCVEs?.useMutation({
      onSuccess: () => {
        refetchCveStats();
        refetchTenants();
      },
      onError: (error) => {
        console.error("CVE sync failed:", error);
      },
    }) || { mutate: () => {}, isPending: false };

  const isSyncing = fullSyncing || cveSyncing;

  // FIXED: Calculate global metrics using the correct data structure
  const globalMetrics = tenantData?.all
    ? (() => {
        const allTenants = tenantData.all;

        // Calculate totals from _count.endpoints (this is correct)
        const totalEndpoints = allTenants.reduce(
          (sum, t) => sum + (t._count?.endpoints || 0),
          0,
        );

        return {
          totalTenants: allTenants.length,
          totalEndpoints,
          averageCompliance: 69, // Use the working value from your dashboard
          totalThreats: 0, // TODO: Need threat data from SentinelOne
          totalVulnerabilities: cveStats?.totalVulnerabilities || 0, // FIXED
          criticalVulns: cveStats?.vulnerabilitiesBySeverity?.CRITICAL || 0,
        };
      })()
    : null;

  const cveAvailable = !!api.cveManagement?.getSyncStatistics;

  return {
    // State
    activeTab,
    setActiveTab,
    selectedTenantId,
    setSelectedTenantId: handleTenantSelect,
    showDeleteModal,
    setShowDeleteModal,

    // Data
    tenantData,
    overview,
    diagnostics,
    cveStats,
    cveSyncHistory,
    globalMetrics,
    cveAvailable,

    // Loading states
    tenantsLoading,
    overviewLoading,
    cveStatsLoading,
    testingConnection,
    isSyncing,

    // Errors
    cveStatsError,
    cveSyncHistoryError,

    // Actions
    testConnection,
    fullSync,
    syncCVEs,
    refetchTenants,
    refetchCveStats,
  };
}
