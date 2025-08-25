// Replace src/app/_components/admin/AdminDashboardContent.tsx
import type { AdminTab } from "~/hooks/admin/useAdminDashboard";
import { OverviewTab } from "./tabs/OverviewTab";
import { SecurityTab } from "./tabs/SecurityTab";
import { VulnerabilitiesTab } from "./tabs/VulnerabilitiesTab";
import { ComplianceTab } from "./tabs/ComplianceTab";
import { TenantsTab } from "./tabs/TenantsTab";
import { SentinelOneTab } from "./tabs/SentinelOneTab";
import { D9AppManagementPanel } from "./D9AppManagement";

interface AdminDashboardContentProps {
  activeTab: AdminTab;
  globalMetrics: any;
  cveStats: any;
  selectedTenantId: string | null;
  overview: any;
  tenantData: any;
  diagnostics: any;
  cveAvailable: boolean;
  cveSyncHistory: any;
  tenantsLoading: boolean;
  testingConnection: boolean;
  isSyncing: boolean;
  // Enhanced error handling props
  hasErrors?: boolean;
  isLoadingAny?: boolean;
  tenantsError?: any;
  cveStatsError?: any;
  diagnosticsError?: any;
  // Actions
  onTenantSelect: (tenantId: string) => void;
  onDeleteClick: (tenant: any) => void;
  testConnection: () => void;
  fullSync: () => void;
  syncCVEs: () => void;
}

export function AdminDashboardContent({
  activeTab,
  globalMetrics,
  cveStats,
  selectedTenantId,
  overview,
  tenantData,
  diagnostics,
  cveAvailable,
  cveSyncHistory,
  tenantsLoading,
  testingConnection,
  isSyncing,
  hasErrors = false,
  isLoadingAny = false,
  tenantsError,
  cveStatsError,
  diagnosticsError,
  onTenantSelect,
  onDeleteClick,
  testConnection,
  fullSync,
  syncCVEs,
}: AdminDashboardContentProps) {
  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <OverviewTab
            globalMetrics={globalMetrics}
            cveStats={cveStats}
            selectedTenantId={selectedTenantId}
            overview={overview}
            cveAvailable={cveAvailable}
            tenantData={tenantData}
            onTenantSelect={onTenantSelect}
            hasErrors={hasErrors}
            isLoadingAny={isLoadingAny}
            tenantsError={tenantsError}
            cveStatsError={cveStatsError}
          />
        );
      case "security":
        return (
          <SecurityTab
            globalMetrics={globalMetrics}
            cveStats={cveStats}
            tenantData={tenantData}
          />
        );
      case "vulnerabilities":
        return (
          <VulnerabilitiesTab
            cveStats={cveStats}
            cveSyncHistory={cveSyncHistory}
            cveAvailable={cveAvailable}
            isSyncing={isSyncing}
            syncCVEs={syncCVEs}
          />
        );
      case "compliance":
        return (
          <ComplianceTab
            globalMetrics={globalMetrics}
            tenantData={tenantData}
          />
        );
      case "tenants":
        return (
          <TenantsTab
            tenantData={tenantData?.all || []}
            tenantsLoading={tenantsLoading}
            onDeleteClick={onDeleteClick}
          />
        );
      case "sentinelone":
        return (
          <SentinelOneTab
            diagnostics={diagnostics}
            testConnection={testConnection}
            testingConnection={testingConnection}
            fullSync={fullSync}
            isSyncing={isSyncing}
          />
        );
      case "d9apps":
        return <D9AppManagementPanel />;
      default:
        return <div>Tab not found</div>;
    }
  };

  return (
    <div className="py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {renderContent()}
      </div>
    </div>
  );
}
