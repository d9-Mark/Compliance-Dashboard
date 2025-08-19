// components/admin/tabs/TenantsTab.tsx
import { DataTable } from "../ui/DataTable";
import { ActionButton } from "../ui/ActionButton";
import { LoadingSpinner } from "../ui/LoadingSpinner";

interface TenantsTabProps {
  tenantData: any[];
  tenantsLoading: boolean;
  onDeleteClick: (tenant: any) => void;
}

export function TenantsTab({
  tenantData,
  tenantsLoading,
  onDeleteClick,
}: TenantsTabProps) {
  if (tenantsLoading) {
    return <LoadingSpinner size="lg" message="Loading tenants..." />;
  }

  const columns = [
    { key: "name", label: "Name" },
    { key: "slug", label: "Slug" },
    {
      key: "_count",
      label: "Endpoints",
      render: (count: any) => count?.endpoints || 0,
    },
    {
      key: "complianceRate",
      label: "Compliance",
      render: (rate: number) => (
        <span
          className={`font-semibold ${rate >= 80 ? "text-green-600" : rate >= 60 ? "text-orange-600" : "text-red-600"}`}
        >
          {rate || 0}%
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, tenant: any) => (
        <div className="flex space-x-2">
          <ActionButton
            size="sm"
            variant="secondary"
            onClick={() =>
              window.open(`/tenant/${tenant.slug}/dashboard`, "_blank")
            }
          >
            View
          </ActionButton>
          <ActionButton
            size="sm"
            variant="danger"
            onClick={() => onDeleteClick(tenant)}
          >
            Delete
          </ActionButton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Tenant Management
        </h2>
        <ActionButton variant="primary">Add Tenant</ActionButton>
      </div>

      <DataTable
        columns={columns}
        data={tenantData}
        emptyMessage="No tenants found"
      />
    </div>
  );
}
