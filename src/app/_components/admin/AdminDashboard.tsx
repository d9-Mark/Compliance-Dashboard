// Replace src/app/_components/admin/AdminDashboard.tsx - Re-enable content gradually
import { useAdminDashboard } from "~/hooks/admin/useAdminDashboard";
import { AdminDashboardHeader } from "./AdminDashboardHeader";
import { AdminDashboardNavigation } from "./AdminDashboardNavigation";
import { AdminDashboardContent } from "./AdminDashboardContent";
import { LoadingSpinner } from "./ui/LoadingSpinner";
import type { Session } from "next-auth";

interface AdminDashboardProps {
  session: Session;
}

export function AdminDashboard({ session }: AdminDashboardProps) {
  const {
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
    testingConnection,
    isSyncing,

    // Enhanced error handling
    hasErrors,
    isLoadingAny,
    tenantsError,
    cveStatsError,
    diagnosticsError,

    // Actions
    testConnection,
    fullSync,
    syncCVEs,
  } = useAdminDashboard(session);

  if (tenantsLoading && !tenantData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" message="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminDashboardHeader session={session} />
      <AdminDashboardNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Enhanced content with error handling */}
      <AdminDashboardContent
        activeTab={activeTab}
        globalMetrics={globalMetrics}
        cveStats={cveStats}
        selectedTenantId={selectedTenantId}
        overview={overview}
        tenantData={tenantData}
        diagnostics={diagnostics}
        cveAvailable={cveAvailable}
        cveSyncHistory={cveSyncHistory}
        tenantsLoading={tenantsLoading}
        testingConnection={testingConnection}
        isSyncing={isSyncing}
        hasErrors={hasErrors}
        isLoadingAny={isLoadingAny}
        tenantsError={tenantsError}
        cveStatsError={cveStatsError}
        diagnosticsError={diagnosticsError}
        onTenantSelect={setSelectedTenantId}
        onDeleteClick={setShowDeleteModal}
        testConnection={testConnection}
        fullSync={fullSync}
        syncCVEs={syncCVEs}
      />
    </div>
  );
}
