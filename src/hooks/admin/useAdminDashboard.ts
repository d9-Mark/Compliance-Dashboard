// hooks/admin/useAdminDashboard.ts
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
        const allTenants = tenantData.all; // This is the actual array
        return {
          totalTenants: allTenants.length,
          totalEndpoints: allTenants.reduce(
            (sum, t) => sum + (t.endpoints?.length || 0),
            0,
          ),
          averageCompliance:
            allTenants.length > 0
              ? Math.round(
                  allTenants.reduce((sum, t) => {
                    const endpoints = t.endpoints || [];
                    const tenantAvg =
                      endpoints.length > 0
                        ? endpoints.reduce(
                            (eSum, e) => eSum + (e.complianceScore || 0),
                            0,
                          ) / endpoints.length
                        : 0;
                    return sum + tenantAvg;
                  }, 0) / allTenants.length,
                )
              : 0,
          totalThreats: allTenants.reduce(
            (sum, t) =>
              sum +
              (t.endpoints || []).reduce(
                (eSum, e) => eSum + (e.activeThreats || 0),
                0,
              ),
            0,
          ),
          totalVulnerabilities: cveStats?.totalEndpointVulnerabilities || 0,
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
    setSelectedTenantId,
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
