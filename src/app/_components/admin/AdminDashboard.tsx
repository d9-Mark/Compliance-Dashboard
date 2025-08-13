// components/admin/AdminDashboard.tsx (Refactored main component)
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

    // Actions
    testConnection,
    fullSync,
    syncCVEs,
  } = useAdminDashboard(session);

  if (tenantsLoading) {
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
        onTenantSelect={setSelectedTenantId}
        onDeleteClick={setShowDeleteModal}
        testConnection={testConnection}
        fullSync={fullSync}
        syncCVEs={syncCVEs}
      />

      {/* Delete Modal (if you want to keep it) */}
      {showDeleteModal && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Delete Tenant</h3>
            <p className="mt-2 text-gray-600">
              Are you sure you want to delete "{showDeleteModal.name}"?
            </p>
            <div className="mt-4 flex space-x-3">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="rounded bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Add delete logic here
                  console.log("Delete tenant:", showDeleteModal);
                  setShowDeleteModal(null);
                }}
                className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
