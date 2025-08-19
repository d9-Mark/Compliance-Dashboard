// components/admin/AdminDashboardNavigation.tsx
import type { AdminTab } from "~/hooks/admin/useAdminDashboard";

interface AdminDashboardNavigationProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

const tabs = [
  { key: "overview" as AdminTab, label: "Overview", icon: "📊" },
  { key: "security" as AdminTab, label: "Security", icon: "🔒" },
  { key: "vulnerabilities" as AdminTab, label: "Vulnerabilities", icon: "🛡️" },
  { key: "compliance" as AdminTab, label: "Compliance", icon: "✅" },
  { key: "tenants" as AdminTab, label: "Tenants", icon: "🏢" },
  { key: "sentinelone" as AdminTab, label: "SentinelOne", icon: "🔗" },
  { key: "d9apps" as AdminTab, label: "D9 Apps", icon: "📱" },
];

export function AdminDashboardNavigation({
  activeTab,
  onTabChange,
}: AdminDashboardNavigationProps) {
  return (
    <div className="bg-white shadow">
      <div className="px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`border-b-2 px-1 py-4 text-sm font-medium ${
                activeTab === tab.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
